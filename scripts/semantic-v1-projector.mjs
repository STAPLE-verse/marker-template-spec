import {
  analyzeSemanticV1Bindings,
  isSemanticAbsoluteIri,
  semanticDefaultDatatype,
  semanticScalarKey,
  validateSemanticV1,
} from "./semantic-v1-conformance.mjs"

function escapePointerToken(token) {
  return String(token).replaceAll("~", "~0").replaceAll("/", "~1")
}

function childPointer(pointer, token) {
  return `${pointer}/${escapePointerToken(token)}`
}

function diagnostic(code, pointer, message) {
  return { stage: "semantic-projection", code, pointer, message }
}

function evaluateResponsePath(value, pointer, tokens) {
  let entries = [{ value, pointer }]
  for (let index = 0; index < tokens.length; ) {
    if (tokens[index] === "properties") {
      const name = tokens[index + 1]
      entries = entries.flatMap((entry) => {
        if (
          !entry.value ||
          typeof entry.value !== "object" ||
          Array.isArray(entry.value) ||
          !Object.hasOwn(entry.value, name)
        ) {
          return []
        }
        return [
          {
            value: entry.value[name],
            pointer: childPointer(entry.pointer, name),
          },
        ]
      })
      index += 2
      continue
    }

    entries = entries.flatMap((entry) =>
      Array.isArray(entry.value)
        ? entry.value.map((item, itemIndex) => ({
            value: item,
            pointer: childPointer(entry.pointer, itemIndex),
          }))
        : [],
    )
    index += 1
  }
  return entries
}

function flattenArrayEntries(entries) {
  return entries.flatMap((entry) =>
    Array.isArray(entry.value)
      ? entry.value.map((item, itemIndex) => ({
          value: item,
          pointer: childPointer(entry.pointer, itemIndex),
        }))
      : [entry],
  )
}

function scalarMatchesSchema(value, schema) {
  if (schema.type === "integer") {
    return typeof value === "number" && Number.isInteger(value)
  }
  if (schema.type === "number") return typeof value === "number"
  return typeof value === schema.type
}

function projectedDatatype(value, schemas) {
  const candidates = new Set(
    schemas
      .filter((schema) => scalarMatchesSchema(value, schema))
      .map(semanticDefaultDatatype)
      .filter(Boolean),
  )
  if (candidates.size === 1) return { datatype: [...candidates][0] }

  const stringDatatype = "http://www.w3.org/2001/XMLSchema#string"
  const withoutPlainString = [...candidates].filter(
    (datatype) => datatype !== stringDatatype,
  )
  if (candidates.has(stringDatatype) && withoutPlainString.length === 1) {
    return { datatype: withoutPlainString[0] }
  }

  const integerDatatype = "http://www.w3.org/2001/XMLSchema#integer"
  const doubleDatatype = "http://www.w3.org/2001/XMLSchema#double"
  if (
    candidates.size === 2 &&
    candidates.has(integerDatatype) &&
    candidates.has(doubleDatatype) &&
    Number.isInteger(value)
  ) {
    return { datatype: integerDatatype }
  }

  return { error: true }
}

function appendValues(subject, predicate, values) {
  if (values.length === 0) return
  if (!subject[predicate]) subject[predicate] = []
  subject[predicate].push(...values)
}

function relativeTokens(analysis, parentAnalysis) {
  if (!parentAnalysis) return analysis.tokens
  const tokens = analysis.tokens.slice(parentAnalysis.tokens.length)
  return tokens[0] === "items" ? tokens.slice(1) : tokens
}

function projectLiteral(binding, analysis, entries, diagnostics) {
  const projected = []
  for (const entry of flattenArrayEntries(entries)) {
    if (entry.value === null || entry.value === undefined) continue
    if (!["string", "number", "boolean"].includes(typeof entry.value)) {
      diagnostics.push(
        diagnostic(
          "PROJECTION_VALUE_TYPE_INVALID",
          entry.pointer,
          "A literal binding encountered a non-scalar response value",
        ),
      )
      continue
    }

    if (binding.language !== undefined) {
      projected.push({
        "@value": entry.value,
        "@language": binding.language.toLowerCase(),
      })
      continue
    }

    let datatype = binding.datatypeIri
    if (datatype === undefined) {
      const resolution = projectedDatatype(entry.value, analysis.valueSchemas)
      if (resolution.error) {
        diagnostics.push(
          diagnostic(
            "PROJECTION_LITERAL_DATATYPE_AMBIGUOUS",
            entry.pointer,
            "The response value does not have one deterministic default RDF datatype",
          ),
        )
        continue
      }
      datatype = resolution.datatype
    }
    projected.push({ "@value": entry.value, "@type": datatype })
  }
  return projected
}

function projectIri(binding, entries, diagnostics) {
  const mappings = new Map(
    (binding.valueMappings ?? []).map((mapping) => [
      semanticScalarKey(mapping.value),
      mapping.iri,
    ]),
  )
  const projected = []

  for (const entry of flattenArrayEntries(entries)) {
    if (entry.value === null || entry.value === undefined) continue
    let iri
    if (binding.valueMappings) {
      iri = mappings.get(semanticScalarKey(entry.value))
      if (iri === undefined) {
        diagnostics.push(
          diagnostic(
            "PROJECTION_MAPPING_MISSING",
            entry.pointer,
            `No exact IRI mapping exists for ${JSON.stringify(entry.value)}`,
          ),
        )
        continue
      }
    } else {
      iri = entry.value
      if (!isSemanticAbsoluteIri(iri)) {
        diagnostics.push(
          diagnostic(
            "PROJECTION_IRI_INVALID",
            entry.pointer,
            "A direct IRI binding requires an absolute response IRI",
          ),
        )
        continue
      }
    }
    projected.push({ "@id": iri })
  }
  return projected
}

function createProjectionContext(document, diagnostics) {
  const analyses = analyzeSemanticV1Bindings(document)
  const children = new Map()
  for (const analysis of analyses) {
    const parent = analysis.binding.parentNodePointer ?? null
    const values = children.get(parent) ?? []
    values.push(analysis)
    children.set(parent, values)
  }
  return { children, diagnostics }
}

function projectBindings(subject, responseValue, responsePointer, parentAnalysis, context) {
  const ownerPointer = parentAnalysis?.binding.fieldPointer ?? null
  for (const analysis of context.children.get(ownerPointer) ?? []) {
    const binding = analysis.binding
    const entries = evaluateResponsePath(
      responseValue,
      responsePointer,
      relativeTokens(analysis, parentAnalysis),
    )

    if (binding.valueKind === "literal") {
      appendValues(
        subject,
        binding.predicate,
        projectLiteral(binding, analysis, entries, context.diagnostics),
      )
      continue
    }
    if (binding.valueKind === "iri") {
      appendValues(
        subject,
        binding.predicate,
        projectIri(binding, entries, context.diagnostics),
      )
      continue
    }

    const nodes = []
    for (const entry of flattenArrayEntries(entries)) {
      if (entry.value === null || entry.value === undefined) continue
      if (
        typeof entry.value !== "object" ||
        Array.isArray(entry.value)
      ) {
        context.diagnostics.push(
          diagnostic(
            "PROJECTION_VALUE_TYPE_INVALID",
            entry.pointer,
            "A node binding encountered a non-object response value",
          ),
        )
        continue
      }
      const node = {}
      if (binding.classIri) node["@type"] = [binding.classIri]
      projectBindings(node, entry.value, entry.pointer, analysis, context)
      nodes.push(node)
    }
    appendValues(subject, binding.predicate, nodes)
  }
}

export function projectSemanticV1(document, response, options = {}) {
  const semanticDiagnostics = validateSemanticV1(document)
  if (semanticDiagnostics.length > 0) {
    return {
      expandedJsonLd: null,
      diagnostics: [
        diagnostic(
          "PROJECTION_PRECONDITION_FAILED",
          "",
          "Projection requires a Semantic V1-valid template package",
        ),
      ],
    }
  }
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return {
      expandedJsonLd: null,
      diagnostics: [
        diagnostic(
          "PROJECTION_PRECONDITION_FAILED",
          "",
          "Projection requires a validated object response",
        ),
      ],
    }
  }
  if (
    options.rootInstanceIri !== undefined &&
    !isSemanticAbsoluteIri(options.rootInstanceIri)
  ) {
    return {
      expandedJsonLd: null,
      diagnostics: [
        diagnostic(
          "PROJECTION_ROOT_IRI_INVALID",
          "/rootInstanceIri",
          "rootInstanceIri must be an absolute IRI",
        ),
      ],
    }
  }

  const diagnostics = []
  const root = {}
  if (options.rootInstanceIri !== undefined) root["@id"] = options.rootInstanceIri
  if (document.semantics.root?.classIri) {
    root["@type"] = [document.semantics.root.classIri]
  }

  const context = createProjectionContext(document, diagnostics)
  projectBindings(root, response, "", undefined, context)

  return {
    expandedJsonLd: diagnostics.length === 0 ? [root] : null,
    diagnostics,
  }
}
