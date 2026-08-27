import Ajv2020 from "ajv/dist/2020.js"
import { semanticV1ComponentSchema } from "./generated/schemas.js"
import type {
  ConformanceDiagnostic,
  JsonPrimitive,
  SemanticBinding,
  SemanticNodeBinding,
  SemanticV1Component,
} from "./types.js"

export type JsonSchemaNode = Record<string, unknown>
type ScalarType = "boolean" | "integer" | "number" | "string"
export type FieldResolutionStatus = "invalid" | "cycle" | "unresolved" | "resolved"

export interface TypedValueSchema extends JsonSchemaNode {
  type: string
  format?: string
  enum?: JsonPrimitive[]
  const?: JsonPrimitive
}

interface VariantState {
  active: Set<object>
  visited: Set<object>
  result: JsonSchemaNode[]
  cycles: Set<object>
}

interface FieldResolution {
  status: FieldResolutionStatus
  schemas: JsonSchemaNode[]
  tokens?: string[] | undefined
}

interface ResolvedBinding {
  status: FieldResolutionStatus
  schemas: JsonSchemaNode[]
  tokens?: string[] | undefined
}

export interface SemanticBindingAnalysis {
  index: number
  binding: SemanticBinding
  tokens?: string[] | undefined
  resolutionStatus: FieldResolutionStatus
  fieldSchemas: JsonSchemaNode[]
  valueSchemas: TypedValueSchema[]
  unsupportedType: boolean
}

interface SemanticDocument {
  form?: {
    schema?: JsonSchemaNode
  }
  semantics?: SemanticV1Component
}

const componentAjv = new Ajv2020({ allErrors: true, strict: true })
const validateComponent = componentAjv.compile(semanticV1ComponentSchema)

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

function escapePointerToken(token: string | number): string {
  return String(token).replaceAll("~", "~0").replaceAll("/", "~1")
}

function childPointer(pointer: string, token: string | number): string {
  return `${pointer}/${escapePointerToken(token)}`
}

function diagnostic(
  code: string,
  pointer: string,
  message: string,
  stage = "semantic-profile",
): ConformanceDiagnostic {
  return { stage, code, pointer, message }
}

function componentDiagnostics(semantics: unknown): ConformanceDiagnostic[] {
  if (validateComponent(semantics)) return []
  return (validateComponent.errors ?? []).map((error) => {
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

function resolveJsonPointer(root: unknown, reference: string): unknown {
  if (reference === "#") return root
  if (!reference.startsWith("#/")) return undefined

  let current: unknown = root
  for (const encodedToken of reference.slice(2).split("/")) {
    if (/~(?:[^01]|$)/u.test(encodedToken)) return undefined
    const token = encodedToken.replaceAll("~1", "/").replaceAll("~0", "~")
    if (!current || typeof current !== "object" || !(token in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[token]
  }
  return current
}

function parseFieldPointer(pointer: unknown): string[] | undefined {
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

function expandSchemaVariants(
  schema: unknown,
  root: JsonSchemaNode,
  state?: VariantState,
): { variants: JsonSchemaNode[]; cycles: Set<object> } {
  const active = state?.active ?? new Set<object>()
  const visited = state?.visited ?? new Set<object>()
  const result = state?.result ?? []
  const cycles = state?.cycles ?? new Set<object>()

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
  const schemaNode = schema as JsonSchemaNode
  if (typeof schemaNode.$ref === "string") {
    const target = resolveJsonPointer(root, schemaNode.$ref)
    if (target !== undefined) {
      expandSchemaVariants(target, root, { active, visited, result, cycles })
    }
    active.delete(schema)
    return { variants: result, cycles }
  }

  result.push(schemaNode)

  for (const keyword of schemaVariantArrayKeywords) {
    const children = schemaNode[keyword]
    if (!Array.isArray(children)) continue
    for (const child of children) {
      expandSchemaVariants(child, root, { active, visited, result, cycles })
    }
  }
  for (const keyword of schemaVariantObjectKeywords) {
    if (schemaNode[keyword] && typeof schemaNode[keyword] === "object") {
      expandSchemaVariants(schemaNode[keyword], root, {
        active,
        visited,
        result,
        cycles,
      })
    }
  }
  const dependencies = schemaNode.dependencies
  for (const dependency of Object.values(
    dependencies && typeof dependencies === "object" && !Array.isArray(dependencies)
      ? dependencies
      : {},
  )) {
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

function resolveFieldPointer(root: JsonSchemaNode, pointer: string): FieldResolution {
  const tokens = parseFieldPointer(pointer)
  if (!tokens) return { status: "invalid", schemas: [], tokens: undefined }

  let candidates: JsonSchemaNode[] = [root]
  let encounteredCycle = false
  for (let index = 0; index < tokens.length; ) {
    const next: JsonSchemaNode[] = []
    for (const candidate of candidates) {
      const { variants, cycles } = expandSchemaVariants(candidate, root)
      encounteredCycle ||= cycles.size > 0
      if (tokens[index] === "properties") {
        const name = tokens[index + 1]
        for (const variant of variants) {
          const properties = variant.properties
          const child =
            typeof name === "string" &&
            properties &&
            typeof properties === "object" &&
            !Array.isArray(properties)
              ? (properties as Record<string, unknown>)[name]
              : undefined
          if (child && typeof child === "object" && !Array.isArray(child)) {
            next.push(child as JsonSchemaNode)
          }
        }
      } else {
        for (const variant of variants) {
          const child = variant.items
          if (child && typeof child === "object" && !Array.isArray(child)) {
            next.push(child as JsonSchemaNode)
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

function valueSchemasForField(
  schemas: JsonSchemaNode[],
  root: JsonSchemaNode,
): { schemas: TypedValueSchema[]; unsupported: boolean } {
  const result: TypedValueSchema[] = []
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
        const typedItems = itemVariants.flatMap<TypedValueSchema>((item) => {
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

function jsonScalarType(value: unknown): ScalarType | undefined {
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number"
  if (value === null || !scalarTypes.has(typeof value)) return undefined
  return typeof value as ScalarType
}

function inferSchemaType(schema: JsonSchemaNode): string | undefined {
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

export function isSemanticAbsoluteIri(value: unknown): value is string {
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

function isLanguageTag(value: string): boolean {
  const lower = value.toLowerCase()
  if (grandfatheredLanguageTags.has(lower)) return true
  if (/^x(?:-[A-Za-z0-9]{1,8})+$/u.test(value)) return true
  try {
    return Intl.getCanonicalLocales(value).length === 1
  } catch {
    return false
  }
}

export function semanticScalarKey(value: unknown): string {
  if (typeof value === "number") return `number:${Object.is(value, -0) ? 0 : value}`
  return `${typeof value}:${String(value)}`
}

function scalarMatchesType(value: unknown, type: string): boolean {
  if (type === "integer") return typeof value === "number" && Number.isInteger(value)
  if (type === "number") return typeof value === "number"
  return typeof value === type
}

export function semanticDefaultDatatype(schema: TypedValueSchema): string | undefined {
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

function bindingPointer(index: number, property?: string): string {
  const pointer = `/semantics/bindings/${index}`
  return property === undefined ? pointer : childPointer(pointer, property)
}

function validateIris(
  semantics: SemanticV1Component,
  diagnostics: ConformanceDiagnostic[],
): void {
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
    const iriProperties: Array<[string, string | undefined]> = [
      ["predicate", binding.predicate],
      [
        "datatypeIri",
        binding.valueKind === "literal" ? binding.datatypeIri : undefined,
      ],
      ["classIri", binding.valueKind === "node" ? binding.classIri : undefined],
    ]
    for (const [property, value] of iriProperties) {
      if (value !== undefined && !isSemanticAbsoluteIri(value)) {
        diagnostics.push(
          diagnostic(
            "SEMANTIC_IRI_INVALID",
            bindingPointer(index, property),
            `${property} must be an absolute IRI`,
          ),
        )
      }
    }
    const mappings = binding.valueKind === "iri" ? binding.valueMappings ?? [] : []
    for (const [mappingIndex, mapping] of mappings.entries()) {
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

function validateBindingCompatibility(
  binding: SemanticBinding,
  index: number,
  valueSchemas: TypedValueSchema[],
  diagnostics: ConformanceDiagnostic[],
): void {
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

function validateValueMappings(
  binding: SemanticBinding,
  index: number,
  valueSchemas: TypedValueSchema[],
  diagnostics: ConformanceDiagnostic[],
): void {
  if (binding.valueKind !== "iri" || !binding.valueMappings) return
  const seen = new Set<string>()
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

  const allowed = new Map<string, JsonPrimitive>()
  for (const values of finiteValueSets) {
    if (!values) continue
    for (const value of values) {
      if (value === undefined) continue
      allowed.set(semanticScalarKey(value), value)
    }
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

function isStrictPointerAncestor(ancestorTokens: string[], childTokens: string[]): boolean {
  return (
    ancestorTokens.length < childTokens.length &&
    ancestorTokens.every((token, index) => token === childTokens[index])
  )
}

interface AncestorNodeCandidate {
  index: number
  binding: SemanticNodeBinding
  tokens: string[]
}

function ancestorNodeCandidates(
  bindings: SemanticBinding[],
  childTokens: string[],
): AncestorNodeCandidate[] {
  return bindings
    .map((binding, index) => ({
      binding,
      index,
      tokens: parseFieldPointer(binding.fieldPointer),
    }))
    .filter((candidate): candidate is AncestorNodeCandidate => {
      return (
        candidate.binding.valueKind === "node" &&
        candidate.tokens !== undefined &&
        isStrictPointerAncestor(candidate.tokens, childTokens)
      )
    })
    .sort((left, right) => right.tokens.length - left.tokens.length)
}

export interface SemanticAncestorNodeBinding {
  index: number
  binding: SemanticNodeBinding
  /** True for the single ancestor that a conformant `parentNodePointer` must identify. */
  nearest: boolean
}

/**
 * Returns every `node` binding that structurally contains `fieldPointer`, nearest
 * first. Per the Semantic V1 nearest-containing-node rule, only the first (nearest)
 * entry is a valid `parentNodePointer` target; the rest are included so a caller can
 * present them as context (e.g. a disabled or warned choice) without recomputing
 * pointer-ancestor containment itself.
 *
 * This is the same primitive `validateSemanticV1` uses to enforce node ownership, so
 * a value this function recommends as `nearest` always agrees with the runtime's own
 * validation of that same `parentNodePointer`.
 */
export function findAncestorNodeBindings(
  bindings: SemanticBinding[],
  fieldPointer: string,
): SemanticAncestorNodeBinding[] {
  const childTokens = parseFieldPointer(fieldPointer)
  if (!childTokens) return []

  return ancestorNodeCandidates(bindings, childTokens).map((candidate, position) => ({
    index: candidate.index,
    binding: candidate.binding,
    nearest: position === 0,
  }))
}

function validateNodeOwnership(
  bindings: SemanticBinding[],
  resolved: ResolvedBinding[],
  diagnostics: ConformanceDiagnostic[],
): void {
  const indicesByPointer = new Map<string, number[]>()
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

  const parentByIndex = new Map<number, number>()
  for (const [index, binding] of bindings.entries()) {
    const childTokens = resolved[index]?.tokens
    if (!childTokens) continue
    const nearest = ancestorNodeCandidates(bindings, childTokens)[0]

    if (binding.parentNodePointer === undefined) {
      if (nearest) {
        diagnostics.push(
          diagnostic(
            "SEMANTIC_PARENT_REQUIRED",
            bindingPointer(index, "parentNodePointer"),
            `The nearest containing node is ${nearest.binding.fieldPointer}`,
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
    if (parentIndex === undefined || bindings[parentIndex]?.valueKind !== "node") {
      diagnostics.push(
        diagnostic(
          "SEMANTIC_PARENT_NOT_NODE",
          bindingPointer(index, "parentNodePointer"),
          "parentNodePointer must identify a node binding",
        ),
      )
      continue
    }
    if (!nearest || nearest.index !== parentIndex) {
      diagnostics.push(
        diagnostic(
          nearest
            ? "SEMANTIC_PARENT_NOT_NEAREST"
            : "SEMANTIC_PARENT_OUTSIDE_NODE",
          bindingPointer(index, "parentNodePointer"),
          nearest
            ? `parentNodePointer must identify the nearest node ${nearest.binding.fieldPointer}`
            : "The child field is not contained by the identified node field",
        ),
      )
    }
  }

  for (const startIndex of parentByIndex.keys()) {
    const path = new Set<number>()
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
      const parent = parentByIndex.get(current)
      if (parent === undefined) break
      current = parent
    }
  }
}

export function analyzeSemanticV1Bindings(document: unknown): SemanticBindingAnalysis[] {
  if (!document || typeof document !== "object") return []
  const candidate = document as SemanticDocument
  const rootSchema = candidate.form?.schema
  const bindings = candidate.semantics?.bindings
  if (!rootSchema || typeof rootSchema !== "object" || !Array.isArray(bindings)) {
    return []
  }

  return bindings.map((binding, index): SemanticBindingAnalysis => {
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

export function validateSemanticV1(document: unknown): ConformanceDiagnostic[] {
  if (!document || typeof document !== "object") return []
  const candidate = document as SemanticDocument
  if (candidate.semantics === undefined) {
    return []
  }

  const structuralDiagnostics = componentDiagnostics(candidate.semantics)
  if (structuralDiagnostics.length > 0) return structuralDiagnostics

  const diagnostics: ConformanceDiagnostic[] = []
  const semantics = candidate.semantics
  const rootSchema = candidate.form?.schema
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

  const resolved: ResolvedBinding[] = []
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

export function semanticV1Validator(
  _semantics: unknown,
  document: unknown,
): ConformanceDiagnostic[] {
  return validateSemanticV1(document)
}
