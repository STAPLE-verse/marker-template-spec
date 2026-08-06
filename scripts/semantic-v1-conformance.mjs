import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "ajv/dist/2020.js"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, "..")
const componentSchema = JSON.parse(
  await readFile(
    path.join(
      repositoryRoot,
      "schemas",
      "semantic",
      "v1",
      "semantics.schema.json",
    ),
    "utf8",
  ),
)

const componentAjv = new Ajv2020({ allErrors: true, strict: true })
const validateComponent = componentAjv.compile(componentSchema)

const XSD = "http://www.w3.org/2001/XMLSchema#"
const scalarTypes = new Set(["boolean", "integer", "number", "string"])
const schemaVariantArrayKeywords = ["allOf", "anyOf", "oneOf"]
const schemaVariantObjectKeywords = ["then", "else"]
const grandfatheredLanguageTags = new Set(
  [
    "art-lojban",
    "cel-gaulish",
    "en-gb-oed",
    "i-ami",
    "i-bnn",
    "i-default",
    "i-enochian",
    "i-hak",
    "i-klingon",
    "i-lux",
    "i-mingo",
    "i-navajo",
    "i-pwn",
    "i-tao",
    "i-tay",
    "i-tsu",
    "no-bok",
    "no-nyn",
    "sgn-be-fr",
    "sgn-be-nl",
    "sgn-ch-de",
    "zh-guoyu",
    "zh-hakka",
    "zh-min",
    "zh-min-nan",
    "zh-xiang",
  ].map((tag) => tag.toLowerCase()),
)

function escapePointerToken(token) {
  return String(token).replaceAll("~", "~0").replaceAll("/", "~1")
}

function childPointer(pointer, token) {
  return `${pointer}/${escapePointerToken(token)}`
}

function diagnostic(code, pointer, message, stage = "semantic-profile") {
  return { stage, code, pointer, message }
}

function componentDiagnostics(semantics) {
  if (validateComponent(semantics)) return []
  return validateComponent.errors.map((error) => {
    const pointer =
      error.keyword === "required"
        ? childPointer(`/semantics${error.instancePath}`, error.params.missingProperty)
        : error.keyword === "additionalProperties"
          ? childPointer(
              `/semantics${error.instancePath}`,
              error.params.additionalProperty,
            )
          : `/semantics${error.instancePath}`
    return diagnostic(
      "SEMANTIC_COMPONENT_INVALID",
      pointer,
      error.message ?? "Invalid Semantic V1 component",
      "semantic-schema",
    )
  })
}

function resolveJsonPointer(root, reference) {
  if (reference === "#") return root
  if (!reference.startsWith("#/")) return undefined

  let current = root
  for (const encodedToken of reference.slice(2).split("/")) {
    if (/~(?:[^01]|$)/u.test(encodedToken)) return undefined
    const token = encodedToken.replaceAll("~1", "/").replaceAll("~0", "~")
    if (!current || typeof current !== "object" || !(token in current)) {
      return undefined
    }
    current = current[token]
  }
  return current
}

function parseFieldPointer(pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return undefined
  const encodedTokens = pointer.slice(1).split("/")
  if (encodedTokens.some((token) => /~(?:[^01]|$)/u.test(token))) return undefined
  const tokens = encodedTokens.map((token) =>
    token.replaceAll("~1", "/").replaceAll("~0", "~"),
  )

  if (tokens[0] !== "properties" || tokens.length < 2) return undefined
  let index = 0
  while (index < tokens.length) {
    if (tokens[index] === "properties" && index + 1 < tokens.length) {
      index += 2
      continue
    }
    if (tokens[index] === "items") {
      index += 1
      continue
    }
    return undefined
  }
  return tokens
}

function expandSchemaVariants(schema, root, state = undefined) {
  const active = state?.active ?? new Set()
  const visited = state?.visited ?? new Set()
  const result = state?.result ?? []
  const cycles = state?.cycles ?? new Set()

  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { variants: result, cycles }
  }
  if (active.has(schema)) {
    cycles.add(schema)
    return { variants: result, cycles }
  }
  if (visited.has(schema)) return { variants: result, cycles }

  visited.add(schema)
  active.add(schema)
  if (typeof schema.$ref === "string") {
    const target = resolveJsonPointer(root, schema.$ref)
    if (target !== undefined) {
      expandSchemaVariants(target, root, { active, visited, result, cycles })
    }
    active.delete(schema)
    return { variants: result, cycles }
  }

  result.push(schema)

  for (const keyword of schemaVariantArrayKeywords) {
    for (const child of schema[keyword] ?? []) {
      expandSchemaVariants(child, root, { active, visited, result, cycles })
    }
  }
  for (const keyword of schemaVariantObjectKeywords) {
    if (schema[keyword] && typeof schema[keyword] === "object") {
      expandSchemaVariants(schema[keyword], root, {
        active,
        visited,
        result,
        cycles,
      })
    }
  }
  for (const dependency of Object.values(schema.dependencies ?? {})) {
    if (!Array.isArray(dependency)) {
      expandSchemaVariants(dependency, root, {
        active,
        visited,
        result,
        cycles,
      })
    }
  }

  active.delete(schema)
  return { variants: result, cycles }
}

function resolveFieldPointer(root, pointer) {
  const tokens = parseFieldPointer(pointer)
  if (!tokens) return { status: "invalid", schemas: [], tokens: undefined }

  let candidates = [root]
  let encounteredCycle = false
  for (let index = 0; index < tokens.length; ) {
    const next = []
    for (const candidate of candidates) {
      const { variants, cycles } = expandSchemaVariants(candidate, root)
      encounteredCycle ||= cycles.size > 0
      if (tokens[index] === "properties") {
        const name = tokens[index + 1]
        for (const variant of variants) {
          const child = variant.properties?.[name]
          if (child && typeof child === "object" && !Array.isArray(child)) {
            next.push(child)
          }
        }
      } else {
        for (const variant of variants) {
          const child = variant.items
          if (child && typeof child === "object" && !Array.isArray(child)) {
            next.push(child)
          }
        }
      }
    }
    candidates = [...new Set(next)]
    if (candidates.length === 0) {
      return {
        status: encounteredCycle ? "cycle" : "unresolved",
        schemas: [],
        tokens,
      }
    }
    index += tokens[index] === "properties" ? 2 : 1
  }

  return { status: "resolved", schemas: candidates, tokens }
}

function valueSchemasForField(schemas, root) {
  const result = []
  let unsupported = false

  for (const schema of schemas) {
    const { variants } = expandSchemaVariants(schema, root)
    for (const variant of variants) {
      if (variant.type === "array") {
        if (!variant.items || typeof variant.items !== "object") {
          unsupported = true
          continue
        }
        const { variants: itemVariants } = expandSchemaVariants(variant.items, root)
        const typedItems = itemVariants.flatMap((item) => {
          const type = inferSchemaType(item)
          if (type) return [{ ...item, type }]
          if (typeof item.format === "string") {
            return [{ ...item, type: "string" }]
          }
          return []
        })
        if (typedItems.length === 0) unsupported = true
        result.push(...typedItems)
      } else {
        const type = inferSchemaType(variant)
        if (type) result.push({ ...variant, type })
        else if (typeof variant.format === "string") {
          result.push({ ...variant, type: "string" })
        }
      }
    }
  }

  return { schemas: [...new Set(result)], unsupported }
}

function jsonScalarType(value) {
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number"
  if (value === null || !scalarTypes.has(typeof value)) return undefined
  return typeof value
}

function inferSchemaType(schema) {
  if (typeof schema.type === "string") return schema.type
  if (Object.hasOwn(schema, "const")) return jsonScalarType(schema.const)
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const types = new Set(schema.enum.map(jsonScalarType))
    if (types.size === 1 && !types.has(undefined)) return [...types][0]
    if ([...types].every((type) => type === "integer" || type === "number")) {
      return "number"
    }
  }
  return undefined
}

export function isSemanticAbsoluteIri(value) {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value)) {
    return false
  }
  if (/[\u0000-\u0020<>"{}|\\^`]/u.test(value)) return false
  if (/%(?![0-9A-Fa-f]{2})/u.test(value)) return false
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function isLanguageTag(value) {
  const lower = value.toLowerCase()
  if (grandfatheredLanguageTags.has(lower)) return true
  if (/^x(?:-[A-Za-z0-9]{1,8})+$/u.test(value)) return true
  try {
    return Intl.getCanonicalLocales(value).length === 1
  } catch {
    return false
  }
}

export function semanticScalarKey(value) {
  if (typeof value === "number") return `number:${Object.is(value, -0) ? 0 : value}`
  return `${typeof value}:${String(value)}`
}

function scalarMatchesType(value, type) {
  if (type === "integer") return typeof value === "number" && Number.isInteger(value)
  if (type === "number") return typeof value === "number"
  return typeof value === type
}

export function semanticDefaultDatatype(schema) {
  if (schema.type === "string") {
    if (schema.format === "date") return `${XSD}date`
    if (schema.format === "date-time") return `${XSD}dateTime`
    if (schema.format === "time") return `${XSD}time`
    return `${XSD}string`
  }
  if (schema.type === "boolean") return `${XSD}boolean`
  if (schema.type === "integer") return `${XSD}integer`
  if (schema.type === "number") return `${XSD}double`
  return undefined
}

function bindingPointer(index, property = undefined) {
  const pointer = `/semantics/bindings/${index}`
  return property === undefined ? pointer : childPointer(pointer, property)
}

function validateIris(semantics, diagnostics) {
  if (semantics.root && !isSemanticAbsoluteIri(semantics.root.classIri)) {
    diagnostics.push(
      diagnostic(
        "SEMANTIC_IRI_INVALID",
        "/semantics/root/classIri",
        "root.classIri must be an absolute IRI",
      ),
    )
  }

  for (const [index, binding] of semantics.bindings.entries()) {
    for (const property of ["predicate", "datatypeIri", "classIri"]) {
      if (
        binding[property] !== undefined &&
        !isSemanticAbsoluteIri(binding[property])
      ) {
        diagnostics.push(
          diagnostic(
            "SEMANTIC_IRI_INVALID",
            bindingPointer(index, property),
            `${property} must be an absolute IRI`,
          ),
        )
      }
    }
    for (const [mappingIndex, mapping] of (binding.valueMappings ?? []).entries()) {
      if (!isSemanticAbsoluteIri(mapping.iri)) {
        diagnostics.push(
          diagnostic(
            "SEMANTIC_IRI_INVALID",
            `${bindingPointer(index, "valueMappings")}/${mappingIndex}/iri`,
            "A mapped IRI must be absolute",
          ),
        )
      }
    }
  }
}

function validateBindingCompatibility(binding, index, valueSchemas, diagnostics) {
  const types = new Set(valueSchemas.map((schema) => schema.type))
  const scalarOnly = [...types].every((type) => scalarTypes.has(type))
  const objectOnly = types.size > 0 && [...types].every((type) => type === "object")

  if (binding.valueKind === "node" && !objectOnly) {
    diagnostics.push(
      diagnostic(
        "SEMANTIC_BINDING_TYPE_INCOMPATIBLE",
        bindingPointer(index, "valueKind"),
        "A node binding must address an object or a homogeneous array of objects",
      ),
    )
    return
  }
  if (binding.valueKind === "literal" && !scalarOnly) {
    diagnostics.push(
      diagnostic(
        "SEMANTIC_BINDING_TYPE_INCOMPATIBLE",
        bindingPointer(index, "valueKind"),
        "A literal binding must address a scalar or a homogeneous array of scalars",
      ),
    )
    return
  }
  if (binding.valueKind === "iri") {
    const compatible = binding.valueMappings
      ? scalarOnly
      : types.size > 0 && [...types].every((type) => type === "string")
    if (!compatible) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_BINDING_TYPE_INCOMPATIBLE",
          bindingPointer(index, "valueKind"),
          binding.valueMappings
            ? "A mapped IRI binding must address a scalar or scalar array"
            : "A direct IRI binding must address a string or string array",
        ),
      )
      return
    }
  }

  if (binding.valueKind !== "literal") return

  if (binding.language !== undefined) {
    const compatible = valueSchemas.every(
      (schema) => schema.type === "string" && schema.format === undefined,
    )
    if (!compatible) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_LANGUAGE_INCOMPATIBLE",
          bindingPointer(index, "language"),
          "A language tag is allowed only for an unformatted string field",
        ),
      )
    } else if (!isLanguageTag(binding.language)) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_LANGUAGE_INVALID",
          bindingPointer(index, "language"),
          "language must be a structurally valid BCP 47 tag",
        ),
      )
    }
  }

  if (binding.datatypeIri !== undefined) {
    const compatible = valueSchemas.every((schema) => {
      if (schema.type === "string" && schema.format === undefined) return true
      return binding.datatypeIri === semanticDefaultDatatype(schema)
    })
    if (!compatible) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_DATATYPE_INCOMPATIBLE",
          bindingPointer(index, "datatypeIri"),
          "datatypeIri is incompatible with the bound Core field type or format",
        ),
      )
    }
  }
}

function validateValueMappings(binding, index, valueSchemas, diagnostics) {
  if (!binding.valueMappings) return
  const seen = new Set()
  const mappingsPointer = bindingPointer(index, "valueMappings")

  for (const [mappingIndex, mapping] of binding.valueMappings.entries()) {
    const key = semanticScalarKey(mapping.value)
    if (seen.has(key)) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_MAPPING_VALUE_DUPLICATE",
          `${mappingsPointer}/${mappingIndex}/value`,
          "Each mapping source value must occur exactly once",
        ),
      )
    }
    seen.add(key)

    if (!valueSchemas.some((schema) => scalarMatchesType(mapping.value, schema.type))) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_MAPPING_VALUE_TYPE",
          `${mappingsPointer}/${mappingIndex}/value`,
          "The mapping source value is incompatible with the bound field type",
        ),
      )
    }
  }

  const finiteValueSets = valueSchemas.map((schema) =>
    Array.isArray(schema.enum)
      ? schema.enum
      : Object.hasOwn(schema, "const")
        ? [schema.const]
        : undefined,
  )
  if (finiteValueSets.some((values) => values === undefined)) return

  const allowed = new Map()
  for (const values of finiteValueSets) {
    for (const value of values) allowed.set(semanticScalarKey(value), value)
  }
  for (const [mappingIndex, mapping] of binding.valueMappings.entries()) {
    if (!allowed.has(semanticScalarKey(mapping.value))) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_MAPPING_VALUE_NOT_ALLOWED",
          `${mappingsPointer}/${mappingIndex}/value`,
          "The mapping source value is not allowed by the bound field",
        ),
      )
    }
  }
  for (const [key, value] of allowed) {
    if (!seen.has(key)) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_MAPPING_ENUM_UNCOVERED",
          mappingsPointer,
          `The allowed value ${JSON.stringify(value)} has no IRI mapping`,
        ),
      )
    }
  }
}

function isStrictPointerAncestor(ancestorTokens, childTokens) {
  return (
    ancestorTokens.length < childTokens.length &&
    ancestorTokens.every((token, index) => token === childTokens[index])
  )
}

function validateNodeOwnership(bindings, resolved, diagnostics) {
  const indicesByPointer = new Map()
  for (const [index, binding] of bindings.entries()) {
    const indices = indicesByPointer.get(binding.fieldPointer) ?? []
    indices.push(index)
    indicesByPointer.set(binding.fieldPointer, indices)
    if (indices.length > 1) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_FIELD_POINTER_DUPLICATE",
          bindingPointer(index, "fieldPointer"),
          "Only one binding may address a field pointer",
        ),
      )
    }
  }

  const parentByIndex = new Map()
  for (const [index, binding] of bindings.entries()) {
    const childTokens = resolved[index]?.tokens
    if (!childTokens) continue
    const containingNodes = bindings
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(
        ({ candidate, candidateIndex }) =>
          candidate.valueKind === "node" &&
          resolved[candidateIndex]?.tokens &&
          isStrictPointerAncestor(resolved[candidateIndex].tokens, childTokens),
      )
      .sort(
        (left, right) =>
          resolved[right.candidateIndex].tokens.length -
          resolved[left.candidateIndex].tokens.length,
      )
    const nearest = containingNodes[0]

    if (binding.parentNodePointer === undefined) {
      if (nearest) {
        diagnostics.push(
          diagnostic(
            "SEMANTIC_PARENT_REQUIRED",
            bindingPointer(index, "parentNodePointer"),
            `The nearest containing node is ${nearest.candidate.fieldPointer}`,
          ),
        )
      }
      continue
    }

    if (!parseFieldPointer(binding.parentNodePointer)) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_PARENT_POINTER_INVALID",
          bindingPointer(index, "parentNodePointer"),
          "parentNodePointer is not a valid Core field pointer",
        ),
      )
      continue
    }

    if (binding.parentNodePointer === binding.fieldPointer) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_PARENT_SELF",
          bindingPointer(index, "parentNodePointer"),
          "A binding cannot own itself",
        ),
      )
      continue
    }

    const parentIndices = indicesByPointer.get(binding.parentNodePointer) ?? []
    if (parentIndices.length !== 1) {
      diagnostics.push(
        diagnostic(
          parentIndices.length === 0
            ? "SEMANTIC_PARENT_NOT_FOUND"
            : "SEMANTIC_PARENT_AMBIGUOUS",
          bindingPointer(index, "parentNodePointer"),
          parentIndices.length === 0
            ? "parentNodePointer does not identify a binding"
            : "parentNodePointer identifies a duplicated field binding",
        ),
      )
      continue
    }

    const parentIndex = parentIndices[0]
    parentByIndex.set(index, parentIndex)
    if (bindings[parentIndex].valueKind !== "node") {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_PARENT_NOT_NODE",
          bindingPointer(index, "parentNodePointer"),
          "parentNodePointer must identify a node binding",
        ),
      )
      continue
    }
    if (!nearest || nearest.candidateIndex !== parentIndex) {
      diagnostics.push(
        diagnostic(
          nearest
            ? "SEMANTIC_PARENT_NOT_NEAREST"
            : "SEMANTIC_PARENT_OUTSIDE_NODE",
          bindingPointer(index, "parentNodePointer"),
          nearest
            ? `parentNodePointer must identify the nearest node ${nearest.candidate.fieldPointer}`
            : "The child field is not contained by the identified node field",
        ),
      )
    }
  }

  for (const startIndex of parentByIndex.keys()) {
    const path = new Set()
    let current = startIndex
    while (parentByIndex.has(current)) {
      if (path.has(current)) {
        diagnostics.push(
          diagnostic(
            "SEMANTIC_PARENT_CYCLE",
            bindingPointer(startIndex, "parentNodePointer"),
            "parentNodePointer relationships must not contain a cycle",
          ),
        )
        break
      }
      path.add(current)
      current = parentByIndex.get(current)
    }
  }
}

export function analyzeSemanticV1Bindings(document) {
  const rootSchema = document?.form?.schema
  const bindings = document?.semantics?.bindings
  if (!rootSchema || typeof rootSchema !== "object" || !Array.isArray(bindings)) {
    return []
  }

  return bindings.map((binding, index) => {
    const resolution = resolveFieldPointer(rootSchema, binding.fieldPointer)
    const values =
      resolution.status === "resolved"
        ? valueSchemasForField(resolution.schemas, rootSchema)
        : { schemas: [], unsupported: true }
    return {
      index,
      binding,
      tokens: resolution.tokens,
      resolutionStatus: resolution.status,
      fieldSchemas: resolution.schemas,
      valueSchemas: values.schemas,
      unsupportedType: values.unsupported,
    }
  })
}

export function validateSemanticV1(document) {
  if (!document || typeof document !== "object" || document.semantics === undefined) {
    return []
  }

  const structuralDiagnostics = componentDiagnostics(document.semantics)
  if (structuralDiagnostics.length > 0) return structuralDiagnostics

  const diagnostics = []
  const semantics = document.semantics
  const rootSchema = document.form?.schema
  if (!rootSchema || typeof rootSchema !== "object") {
    return [
      diagnostic(
        "SEMANTIC_FORM_SCHEMA_REQUIRED",
        "/form/schema",
        "Semantic validation requires a Core-valid form.schema",
      ),
    ]
  }

  validateIris(semantics, diagnostics)

  const resolved = []
  for (const analysis of analyzeSemanticV1Bindings(document)) {
    const { binding, index } = analysis
    resolved[index] = {
      status: analysis.resolutionStatus,
      schemas: analysis.fieldSchemas,
      tokens: analysis.tokens,
    }
    if (analysis.resolutionStatus !== "resolved") {
      const code =
        analysis.resolutionStatus === "invalid"
          ? "SEMANTIC_FIELD_POINTER_INVALID"
          : analysis.resolutionStatus === "cycle"
            ? "SEMANTIC_FIELD_POINTER_REF_CYCLE"
            : "SEMANTIC_FIELD_POINTER_UNRESOLVED"
      diagnostics.push(
        diagnostic(
          code,
          bindingPointer(index, "fieldPointer"),
          `fieldPointer ${binding.fieldPointer} does not resolve to an instance field`,
        ),
      )
      continue
    }

    if (analysis.unsupportedType || analysis.valueSchemas.length === 0) {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_FIELD_TYPE_UNRESOLVED",
          bindingPointer(index, "fieldPointer"),
          "The effective Core field type cannot be determined unambiguously",
        ),
      )
      continue
    }
    validateBindingCompatibility(binding, index, analysis.valueSchemas, diagnostics)
    validateValueMappings(binding, index, analysis.valueSchemas, diagnostics)
  }

  validateNodeOwnership(semantics.bindings, resolved, diagnostics)
  return diagnostics
}

export function semanticV1Validator(_semantics, document) {
  return validateSemanticV1(document)
}
