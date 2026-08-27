import assert from "node:assert/strict"
import test from "node:test"
import {
  analyzeSemanticV1Bindings,
  findAncestorNodeBindings,
} from "@staple-verse/marker-template-runtime"

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

test("analyzeSemanticV1Bindings reports resolution status and effective value schemas", () => {
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
    literal("/properties/missing"),
  ])

  const analysis = analyzeSemanticV1Bindings(document)
  assert.equal(analysis.length, 3)

  assert.equal(analysis[0].resolutionStatus, "resolved")
  assert.deepEqual(analysis[0].tokens, ["properties", "contributors"])
  assert.equal(analysis[0].valueSchemas.length, 1)
  assert.equal(analysis[0].valueSchemas[0].type, "object")
  assert.equal(analysis[0].unsupportedType, false)

  assert.equal(analysis[1].resolutionStatus, "resolved")
  assert.equal(analysis[1].valueSchemas[0].type, "string")

  assert.equal(analysis[2].resolutionStatus, "unresolved")
  assert.deepEqual(analysis[2].fieldSchemas, [])
  assert.equal(analysis[2].unsupportedType, true)
})

test("analyzeSemanticV1Bindings returns an empty analysis without a schema or bindings", () => {
  assert.deepEqual(analyzeSemanticV1Bindings({}), [])
  assert.deepEqual(analyzeSemanticV1Bindings({ form: { schema: { type: "object" } } }), [])
  assert.deepEqual(analyzeSemanticV1Bindings(null), [])
})

test("findAncestorNodeBindings orders containing node bindings nearest first", () => {
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
  const unrelatedNode = {
    fieldPointer: "/properties/funder",
    predicate: "https://schema.org/funder",
    valueKind: "node",
  }
  const bindings = [projectNode, contactNode, unrelatedNode]
  const namePointer = "/properties/project/properties/contact/properties/name"

  const ancestors = findAncestorNodeBindings(bindings, namePointer)

  assert.deepEqual(
    ancestors.map((match) => ({ index: match.index, nearest: match.nearest })),
    [
      { index: 1, nearest: true },
      { index: 0, nearest: false },
    ],
  )
  assert.equal(ancestors[0].binding, contactNode)
  assert.equal(ancestors[1].binding, projectNode)
})

test("findAncestorNodeBindings excludes non-node bindings and non-ancestors", () => {
  const bindings = [
    literal("/properties/project"),
    {
      fieldPointer: "/properties/funder",
      predicate: "https://schema.org/funder",
      valueKind: "node",
    },
  ]

  assert.deepEqual(findAncestorNodeBindings(bindings, "/properties/project/properties/name"), [])
})

test("findAncestorNodeBindings returns no matches for a malformed field pointer", () => {
  const bindings = [
    {
      fieldPointer: "/properties/project",
      predicate: "https://schema.org/about",
      valueKind: "node",
    },
  ]

  assert.deepEqual(findAncestorNodeBindings(bindings, "/properties/bad~2escape"), [])
})

test("findAncestorNodeBindings agrees with validateSemanticV1's nearest-node enforcement", async () => {
  const { validateSemanticV1 } = await import("@staple-verse/marker-template-runtime")
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
  const bindings = [projectNode, contactNode]

  const [nearest] = findAncestorNodeBindings(bindings, namePointer)
  assert.equal(nearest.binding.fieldPointer, contactNode.fieldPointer)

  const document = template(schema, [
    ...bindings,
    literal(namePointer, { parentNodePointer: nearest.binding.fieldPointer }),
  ])
  assert.deepEqual(validateSemanticV1(document), [])
})
