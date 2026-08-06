import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv from "ajv"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

export const CORE_PROFILE_URI =
  "https://staplescience.com/profiles/marker-template/core/v1"
export const SEMANTIC_PROFILE_URI =
  "https://staplescience.com/profiles/marker-template/semantic/v1"
export const PACKAGE_SCHEMA_ID =
  "https://staplescience.com/schemas/marker-template/core/v1/package.schema.json"
export const FORM_SCHEMA_DIALECT = "http://json-schema.org/draft-07/schema#"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, "..")
const packageSchema = JSON.parse(
  await readFile(
    path.join(repositoryRoot, "schemas", "v1", "marker-template.schema.json"),
    "utf8",
  ),
)

const packageAjv = new Ajv2020({ allErrors: true, strict: true, validateFormats: true })
addFormats(packageAjv)
const validatePackage = packageAjv.compile(packageSchema)

const formSchemaAjv = new Ajv({ allErrors: true, strict: false, validateFormats: false })

const allowedSchemaKeywords = new Set([
  "$comment",
  "$id",
  "$ref",
  "$schema",
  "additionalProperties",
  "allOf",
  "anyOf",
  "const",
  "default",
  "definitions",
  "dependencies",
  "description",
  "else",
  "enum",
  "examples",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "if",
  "items",
  "maxItems",
  "maxLength",
  "maxProperties",
  "maximum",
  "minItems",
  "minLength",
  "minProperties",
  "minimum",
  "multipleOf",
  "not",
  "oneOf",
  "pattern",
  "properties",
  "readOnly",
  "required",
  "then",
  "title",
  "type",
  "uniqueItems",
  "writeOnly",
])

const allowedFormats = new Set([
  "date",
  "date-time",
  "email",
  "hostname",
  "ipv4",
  "ipv6",
  "regex",
  "time",
  "uri",
  "uri-reference",
  "uuid",
])

const allowedWidgets = new Set([
  "alt-date",
  "alt-datetime",
  "checkbox",
  "date",
  "date-time",
  "email",
  "hidden",
  "password",
  "radio",
  "range",
  "select",
  "text",
  "textarea",
  "updown",
  "uri",
])

const schemaArrayKeywords = ["allOf", "anyOf", "oneOf"]
const schemaObjectKeywords = ["not", "if", "then", "else"]

function escapePointerToken(token) {
  return String(token).replaceAll("~", "~0").replaceAll("/", "~1")
}

function childPointer(pointer, token) {
  return `${pointer}/${escapePointerToken(token)}`
}

function diagnostic(stage, code, pointer, message) {
  return { stage, code, pointer, message }
}

function packageDiagnostics(document) {
  if (validatePackage(document)) return []

  return validatePackage.errors.map((error) => {
    const pointer =
      error.keyword === "required"
        ? childPointer(error.instancePath, error.params.missingProperty)
        : error.keyword === "additionalProperties"
          ? childPointer(error.instancePath, error.params.additionalProperty)
          : error.instancePath || ""
    return diagnostic("package", "PACKAGE_SCHEMA_INVALID", pointer, error.message ?? "Invalid package")
  })
}

function resolveLocalReference(root, reference) {
  if (reference === "#") return root
  if (!reference.startsWith("#/")) return undefined

  let current = root
  for (const encodedToken of reference.slice(2).split("/")) {
    const token = encodedToken.replaceAll("~1", "/").replaceAll("~0", "~")
    if (!current || typeof current !== "object" || !(token in current)) return undefined
    current = current[token]
  }
  return current
}

function inspectSchemaNode(node, pointer, root, diagnostics, visited = new Set()) {
  if (!node || typeof node !== "object" || Array.isArray(node) || visited.has(node)) return
  visited.add(node)

  for (const keyword of Object.keys(node)) {
    if (!allowedSchemaKeywords.has(keyword)) {
      diagnostics.push(
        diagnostic(
          "core-profile",
          "CORE_UNSUPPORTED_KEYWORD",
          childPointer(pointer, keyword),
          `The ${keyword} keyword is outside the Core V1 subset`,
        ),
      )
    }
  }

  if (Array.isArray(node.type)) {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "CORE_UNSUPPORTED_TYPE_UNION",
        childPointer(pointer, "type"),
        "Core V1 requires a single JSON Schema type",
      ),
    )
  }

  if (typeof node.format === "string" && !allowedFormats.has(node.format)) {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "CORE_UNSUPPORTED_FORMAT",
        childPointer(pointer, "format"),
        `The ${node.format} format is outside the Core V1 subset`,
      ),
    )
  }

  if (typeof node.$ref === "string") {
    if (!node.$ref.startsWith("#/definitions/")) {
      diagnostics.push(
        diagnostic(
          "core-profile",
          "CORE_EXTERNAL_REF",
          childPointer(pointer, "$ref"),
          "Core V1 references must target local definitions",
        ),
      )
    } else if (resolveLocalReference(root, node.$ref) === undefined) {
      diagnostics.push(
        diagnostic(
          "core-profile",
          "CORE_UNRESOLVED_REF",
          childPointer(pointer, "$ref"),
          `Reference ${node.$ref} does not resolve`,
        ),
      )
    }
  }

  if (Array.isArray(node.items)) {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "CORE_TUPLE_ITEMS",
        childPointer(pointer, "items"),
        "Core V1 arrays must have one homogeneous item schema",
      ),
    )
  } else if (node.items && typeof node.items === "object") {
    inspectSchemaNode(node.items, childPointer(pointer, "items"), root, diagnostics, visited)
  }

  if (
    node.additionalProperties !== undefined &&
    typeof node.additionalProperties !== "boolean"
  ) {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "CORE_DYNAMIC_PROPERTIES",
        childPointer(pointer, "additionalProperties"),
        "Core V1 additionalProperties must be boolean",
      ),
    )
  }

  for (const container of ["properties", "definitions"]) {
    for (const [name, child] of Object.entries(node[container] ?? {})) {
      inspectSchemaNode(
        child,
        childPointer(childPointer(pointer, container), name),
        root,
        diagnostics,
        visited,
      )
    }
  }

  for (const keyword of schemaArrayKeywords) {
    node[keyword]?.forEach((child, index) =>
      inspectSchemaNode(
        child,
        childPointer(childPointer(pointer, keyword), index),
        root,
        diagnostics,
        visited,
      ),
    )
  }

  for (const keyword of schemaObjectKeywords) {
    if (node[keyword] && typeof node[keyword] === "object") {
      inspectSchemaNode(
        node[keyword],
        childPointer(pointer, keyword),
        root,
        diagnostics,
        visited,
      )
    }
  }

  for (const [name, dependency] of Object.entries(node.dependencies ?? {})) {
    if (!Array.isArray(dependency)) {
      inspectSchemaNode(
        dependency,
        childPointer(childPointer(pointer, "dependencies"), name),
        root,
        diagnostics,
        visited,
      )
    }
  }
}

function schemaVariants(schema, root, seen = new Set()) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema) || seen.has(schema)) return []
  seen.add(schema)

  const variants = [schema]
  if (typeof schema.$ref === "string") {
    variants.push(...schemaVariants(resolveLocalReference(root, schema.$ref), root, seen))
  }
  for (const keyword of [...schemaArrayKeywords, ...schemaObjectKeywords]) {
    const children = Array.isArray(schema[keyword]) ? schema[keyword] : [schema[keyword]]
    for (const child of children) variants.push(...schemaVariants(child, root, seen))
  }
  for (const dependency of Object.values(schema.dependencies ?? {})) {
    if (!Array.isArray(dependency)) variants.push(...schemaVariants(dependency, root, seen))
  }
  return variants
}

function fieldEntries(schema, root) {
  const entries = new Map()
  for (const variant of schemaVariants(schema, root)) {
    for (const [name, child] of Object.entries(variant.properties ?? {})) {
      if (!entries.has(name)) entries.set(name, child)
    }
  }
  return entries
}

function inspectUiNode(uiNode, schema, pointer, rootSchema, diagnostics) {
  if (!uiNode || typeof uiNode !== "object" || Array.isArray(uiNode)) {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "UI_INVALID_NODE",
        pointer,
        "A field uiSchema entry must be an object",
      ),
    )
    return
  }

  const fields = fieldEntries(schema, rootSchema)
  const order = uiNode["ui:order"]
  if (order !== undefined && !Array.isArray(order)) {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "UI_INVALID_ORDER",
        childPointer(pointer, "ui:order"),
        "ui:order must be an array of field names",
      ),
    )
  } else if (Array.isArray(order)) {
    const seen = new Set()
    for (let index = 0; index < order.length; index++) {
      const name = order[index]
      const orderPointer = childPointer(childPointer(pointer, "ui:order"), index)
      if (typeof name !== "string") {
        diagnostics.push(
          diagnostic(
            "core-profile",
            "UI_INVALID_ORDER",
            orderPointer,
            "ui:order entries must be strings",
          ),
        )
        continue
      }
      if (name !== "*" && !fields.has(name)) {
        diagnostics.push(
          diagnostic(
            "core-profile",
            "UI_ORDER_UNKNOWN_FIELD",
            orderPointer,
            `ui:order names unknown field ${name}`,
          ),
        )
      }
      if (seen.has(name)) {
        diagnostics.push(
          diagnostic(
            "core-profile",
            "UI_ORDER_DUPLICATE",
            orderPointer,
            `ui:order repeats ${name}`,
          ),
        )
      }
      seen.add(name)
    }
  }

  const widget = uiNode["ui:widget"]
  if (widget !== undefined && typeof widget !== "string") {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "UI_INVALID_WIDGET",
        childPointer(pointer, "ui:widget"),
        "ui:widget must be a portable widget name",
      ),
    )
  } else if (typeof widget === "string" && !allowedWidgets.has(widget)) {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "UI_UNSUPPORTED_WIDGET",
        childPointer(pointer, "ui:widget"),
        `The ${widget} widget is outside the Core V1 subset`,
      ),
    )
  }

  for (const [name, child] of Object.entries(uiNode)) {
    if (name.startsWith("ui:")) continue
    const fieldSchema = fields.get(name)
    if (fieldSchema) {
      inspectUiNode(child, fieldSchema, childPointer(pointer, name), rootSchema, diagnostics)
      continue
    }
    if (name === "items") {
      const itemSchema = schemaVariants(schema, rootSchema)
        .map((variant) => variant.items)
        .find((item) => item && typeof item === "object" && !Array.isArray(item))
      if (!itemSchema) {
        diagnostics.push(
          diagnostic(
            "core-profile",
            "UI_ITEMS_WITHOUT_ARRAY",
            childPointer(pointer, name),
            "uiSchema items requires a corresponding array item schema",
          ),
        )
      } else {
        inspectUiNode(child, itemSchema, childPointer(pointer, name), rootSchema, diagnostics)
      }
      continue
    }
    if (name === "definitions") {
      for (const [definitionName, definitionUi] of Object.entries(child ?? {})) {
        const definitionSchema = rootSchema.definitions?.[definitionName]
        if (!definitionSchema) {
          diagnostics.push(
            diagnostic(
              "core-profile",
              "UI_UNKNOWN_DEFINITION",
              childPointer(childPointer(pointer, name), definitionName),
              `uiSchema names unknown definition ${definitionName}`,
            ),
          )
        } else {
          inspectUiNode(
            definitionUi,
            definitionSchema,
            childPointer(childPointer(pointer, name), definitionName),
            rootSchema,
            diagnostics,
          )
        }
      }
      continue
    }

    diagnostics.push(
      diagnostic(
        "core-profile",
        "UI_UNKNOWN_FIELD",
        childPointer(pointer, name),
        `uiSchema names unknown field ${name}`,
      ),
    )
  }
}

function profileDiagnostics(document) {
  const diagnostics = []
  const schema = document.form.schema

  if (schema.$schema !== FORM_SCHEMA_DIALECT) {
    diagnostics.push(
      diagnostic(
        "form-schema",
        "FORM_SCHEMA_DIALECT",
        "/form/schema/$schema",
        `form.schema must declare ${FORM_SCHEMA_DIALECT}`,
      ),
    )
    return diagnostics
  }

  if (!formSchemaAjv.validateSchema(schema)) {
    return formSchemaAjv.errors.map((error) =>
      diagnostic(
        "form-schema",
        "FORM_SCHEMA_INVALID",
        `/form/schema${error.instancePath}`,
        error.message ?? "Invalid JSON Schema draft-07 document",
      ),
    )
  }

  if (schema.type !== "object") {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "CORE_ROOT_TYPE",
        "/form/schema/type",
        "The form schema root must have type object",
      ),
    )
  }
  if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "CORE_ROOT_PROPERTIES",
        "/form/schema/properties",
        "The form schema root must define a properties object",
      ),
    )
  }

  inspectSchemaNode(schema, "/form/schema", schema, diagnostics)
  inspectUiNode(document.form.uiSchema, schema, "/form/uiSchema", schema, diagnostics)

  if (document.metadata.familyId === document.metadata.versionId) {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "TEMPLATE_IDENTIFIERS_EQUAL",
        "/metadata/versionId",
        "Template family and version identifiers must differ",
      ),
    )
  }

  const createdAt = Date.parse(document.metadata.createdAt)
  const updatedAt = Date.parse(document.metadata.updatedAt)
  if (updatedAt < createdAt) {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "TEMPLATE_TIMESTAMP_ORDER",
        "/metadata/updatedAt",
        "updatedAt must not be earlier than createdAt",
      ),
    )
  }
  if (
    document.metadata.status === "published" &&
    Date.parse(document.metadata.publishedAt) < createdAt
  ) {
    diagnostics.push(
      diagnostic(
        "core-profile",
        "TEMPLATE_TIMESTAMP_ORDER",
        "/metadata/publishedAt",
        "publishedAt must not be earlier than createdAt",
      ),
    )
  }

  return diagnostics
}

export function validateCoreV1(document) {
  const outerDiagnostics = packageDiagnostics(document)
  if (outerDiagnostics.length) return outerDiagnostics
  return profileDiagnostics(document)
}

export function validateFieldPointer(formSchema, pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("/properties/")) return false
  const target = resolveLocalReference(formSchema, `#${pointer}`)
  if (!target || typeof target !== "object" || Array.isArray(target)) return false

  const tokens = pointer.slice(1).split("/").map((token) =>
    token.replaceAll("~1", "/").replaceAll("~0", "~"),
  )
  let index = 0
  while (index < tokens.length) {
    if (tokens[index] === "properties") {
      if (index + 1 >= tokens.length) return false
      index += 2
    } else if (tokens[index] === "items") {
      index += 1
    } else {
      return false
    }
  }
  return true
}

export function validateSemantics(document, validator) {
  if (document.semantics === undefined) return null
  if (!validator) {
    return { profile: SEMANTIC_PROFILE_URI, status: "unrecognized", diagnostics: [] }
  }

  const diagnostics = validator(document.semantics, document) ?? []
  return {
    profile: SEMANTIC_PROFILE_URI,
    status: diagnostics.length ? "invalid" : "valid",
    diagnostics,
  }
}
