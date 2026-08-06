import assert from "node:assert/strict"
import test from "node:test"
import { validateSemanticV1 } from "../../scripts/semantic-v1-conformance.mjs"

const XSD = "http://www.w3.org/2001/XMLSchema#"

function template(schema, bindings, root = undefined) {
  return {
    form: { schema },
    semantics: {
      ...(root ? { root } : {}),
      bindings,
    },
  }
}

function literal(fieldPointer, overrides = {}) {
  return {
    fieldPointer,
    predicate: "https://schema.org/name",
    valueKind: "literal",
    ...overrides,
  }
}

function codes(document) {
  return validateSemanticV1(document).map((item) => item.code)
}

test("Semantic V1 resolves instance-bearing field pointers through local references", () => {
  const schema = {
    type: "object",
    properties: {
      contributors: {
        type: "array",
        items: { $ref: "#/definitions/contributor" },
      },
    },
    definitions: {
      contributor: {
        type: "object",
        properties: {
          name: { type: "string" },
          orcid: { type: "string", format: "uri" },
        },
      },
    },
  }
  const document = template(schema, [
    {
      fieldPointer: "/properties/contributors",
      predicate: "https://schema.org/contributor",
      valueKind: "node",
      classIri: "https://schema.org/Person",
    },
    literal("/properties/contributors/items/properties/name", {
      parentNodePointer: "/properties/contributors",
    }),
    {
      fieldPointer: "/properties/contributors/items/properties/orcid",
      parentNodePointer: "/properties/contributors",
      predicate: "https://schema.org/identifier",
      valueKind: "iri",
    },
  ])

  assert.deepEqual(validateSemanticV1(document), [])
})

test("Semantic V1 rejects unresolved, duplicate, and malformed field pointers", () => {
  const schema = {
    type: "object",
    properties: { title: { type: "string" } },
  }
  const document = template(schema, [
    literal("/properties/title"),
    literal("/properties/title", { predicate: "https://schema.org/headline" }),
    literal("/properties/missing"),
    literal("/properties/bad~2escape"),
  ])

  assert.deepEqual(codes(document), [
    "SEMANTIC_FIELD_POINTER_UNRESOLVED",
    "SEMANTIC_FIELD_POINTER_INVALID",
    "SEMANTIC_FIELD_POINTER_DUPLICATE",
  ])
})

test("Semantic V1 enforces binding type, datatype, and language compatibility", () => {
  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      startDate: { type: "string", format: "date" },
      count: { type: "integer" },
      identifierCount: { type: "integer" },
      details: { type: "object", properties: {} },
    },
  }

  assert.deepEqual(
    codes(
      template(schema, [
        literal("/properties/title", { language: "en-GB" }),
        literal("/properties/startDate", { datatypeIri: `${XSD}date` }),
        literal("/properties/count", { datatypeIri: `${XSD}integer` }),
        {
          fieldPointer: "/properties/details",
          predicate: "https://schema.org/about",
          valueKind: "node",
        },
      ]),
    ),
    [],
  )

  assert.deepEqual(
    codes(
      template(schema, [
        literal("/properties/startDate", { language: "en" }),
        literal("/properties/count", { datatypeIri: `${XSD}double` }),
        literal("/properties/details"),
        {
          fieldPointer: "/properties/identifierCount",
          predicate: "https://schema.org/identifier",
          valueKind: "iri",
        },
      ]),
    ),
    [
      "SEMANTIC_LANGUAGE_INCOMPATIBLE",
      "SEMANTIC_DATATYPE_INCOMPATIBLE",
      "SEMANTIC_BINDING_TYPE_INCOMPATIBLE",
      "SEMANTIC_BINDING_TYPE_INCOMPATIBLE",
    ],
  )
})

test("Semantic V1 infers scalar types from standalone Core oneOf choices", () => {
  const schema = {
    type: "object",
    properties: {
      contactMethod: {
        oneOf: [{ const: "email" }, { const: "phone" }],
      },
      label: {
        type: "string",
        not: { type: "number" },
      },
    },
  }

  assert.deepEqual(
    validateSemanticV1(
      template(schema, [
        literal("/properties/contactMethod"),
        literal("/properties/label", {
          datatypeIri: "https://example.edu/datatypes/Label",
        }),
      ]),
    ),
    [],
  )
})

test("Semantic V1 validates exact mapping types, uniqueness, and finite coverage", () => {
  const schema = {
    type: "object",
    properties: {
      choice: { type: "string", enum: ["person", "organization"] },
    },
  }
  const binding = {
    fieldPointer: "/properties/choice",
    predicate: "https://schema.org/additionalType",
    valueKind: "iri",
    valueMappings: [
      { value: "person", iri: "https://schema.org/Person" },
      { value: "person", iri: "https://example.edu/duplicate" },
      { value: 1, iri: "https://example.edu/number" },
    ],
  }

  assert.deepEqual(codes(template(schema, [binding])), [
    "SEMANTIC_MAPPING_VALUE_DUPLICATE",
    "SEMANTIC_MAPPING_VALUE_TYPE",
    "SEMANTIC_MAPPING_VALUE_NOT_ALLOWED",
    "SEMANTIC_MAPPING_ENUM_UNCOVERED",
  ])
})

test("Semantic V1 enforces nearest node ownership", () => {
  const schema = {
    type: "object",
    properties: {
      project: {
        type: "object",
        properties: {
          contact: {
            type: "object",
            properties: { name: { type: "string" } },
          },
        },
      },
    },
  }
  const projectNode = {
    fieldPointer: "/properties/project",
    predicate: "https://schema.org/about",
    valueKind: "node",
  }
  const contactNode = {
    fieldPointer: "/properties/project/properties/contact",
    parentNodePointer: "/properties/project",
    predicate: "https://schema.org/contactPoint",
    valueKind: "node",
  }
  const namePointer = "/properties/project/properties/contact/properties/name"

  assert.deepEqual(
    codes(
      template(schema, [
        projectNode,
        contactNode,
        literal(namePointer, {
          parentNodePointer: "/properties/project/properties/contact",
        }),
      ]),
    ),
    [],
  )
  assert.deepEqual(
    codes(
      template(schema, [
        projectNode,
        contactNode,
        literal(namePointer, { parentNodePointer: "/properties/project" }),
      ]),
    ),
    ["SEMANTIC_PARENT_NOT_NEAREST"],
  )
  assert.deepEqual(
    codes(template(schema, [projectNode, contactNode, literal(namePointer)])),
    ["SEMANTIC_PARENT_REQUIRED"],
  )
  assert.deepEqual(
    codes(
      template(schema, [
        projectNode,
        literal("/properties/project/properties/contact", {
          parentNodePointer: "/properties/bad~2pointer",
        }),
      ]),
    ),
    ["SEMANTIC_BINDING_TYPE_INCOMPATIBLE", "SEMANTIC_PARENT_POINTER_INVALID"],
  )
})

test("Semantic V1 validates full IRIs without expanding compact-looking values", () => {
  const schema = {
    type: "object",
    properties: { title: { type: "string" } },
  }
  const document = template(
    schema,
    [literal("/properties/title", { predicate: "https://schema.org/name" })],
    { classIri: "https://schema.org/Thing" },
  )
  assert.deepEqual(validateSemanticV1(document), [])

  document.semantics.bindings[0].predicate = "https://schema .org/name"
  assert.deepEqual(codes(document), ["SEMANTIC_IRI_INVALID"])

  document.semantics.bindings[0].predicate = "https://schema.org/%ZZ"
  assert.deepEqual(codes(document), ["SEMANTIC_IRI_INVALID"])
})
