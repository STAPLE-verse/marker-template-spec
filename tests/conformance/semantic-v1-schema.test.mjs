import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import Ajv2020 from "ajv/dist/2020.js"

const schemaPath = path.join(
  process.cwd(),
  "schemas",
  "semantic",
  "v1",
  "semantics.schema.json",
)
const schema = JSON.parse(await readFile(schemaPath, "utf8"))
const ajv = new Ajv2020({ allErrors: true, strict: true })
const validate = ajv.compile(schema)

function isValid(value) {
  return validate(value)
}

function literalBinding(overrides = {}) {
  return {
    fieldPointer: "/properties/title",
    predicate: "http://purl.org/dc/terms/title",
    valueKind: "literal",
    ...overrides,
  }
}

test("Semantic V1 schema publishes the stable component identity", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema")
  assert.equal(
    schema.$id,
    "https://staplescience.com/schemas/marker-template/semantic/v1/semantics.schema.json",
  )
})

test("Semantic V1 requires a root class or at least one binding", () => {
  assert.equal(isValid({}), false)
  assert.equal(isValid({ bindings: [] }), false)
  assert.equal(
    isValid({
      root: { classIri: "https://schema.org/ResearchProject" },
      bindings: [],
    }),
    true,
  )
  assert.equal(isValid({ bindings: [literalBinding()] }), true)
})

test("literal bindings are closed and reject conflicting datatype and language", () => {
  assert.equal(
    isValid({
      bindings: [
        literalBinding({ datatypeIri: "http://www.w3.org/2001/XMLSchema#string" }),
      ],
    }),
    true,
  )
  assert.equal(
    isValid({
      bindings: [literalBinding({ language: "x-private" })],
    }),
    true,
  )
  assert.equal(
    isValid({
      bindings: [literalBinding({ language: "en GB" })],
    }),
    false,
  )
  assert.equal(
    isValid({
      bindings: [
        literalBinding({
          datatypeIri: "http://www.w3.org/2001/XMLSchema#string",
          language: "en",
        }),
      ],
    }),
    false,
  )
  assert.equal(
    isValid({ bindings: [literalBinding({ classIri: "https://schema.org/Thing" })] }),
    false,
  )
})

test("IRI and node bindings accept only their discriminated properties", () => {
  assert.equal(
    isValid({
      bindings: [
        {
          fieldPointer: "/properties/agentType",
          predicate: "https://schema.org/additionalType",
          valueKind: "iri",
          valueMappings: [
            { value: "person", iri: "https://schema.org/Person" },
            { value: false, iri: "https://schema.org/Organization" },
            { value: 0, iri: "https://schema.org/Thing" },
          ],
        },
        {
          fieldPointer: "/properties/contributors",
          predicate: "https://schema.org/contributor",
          valueKind: "node",
          classIri: "https://schema.org/Person",
        },
      ],
    }),
    true,
  )
  assert.equal(
    isValid({
      bindings: [
        {
          fieldPointer: "/properties/agentType",
          predicate: "https://schema.org/additionalType",
          valueKind: "iri",
          valueMappings: [{ value: null, iri: "https://schema.org/Person" }],
        },
      ],
    }),
    false,
  )
  assert.equal(
    isValid({
      bindings: [
        {
          fieldPointer: "/properties/contributors",
          predicate: "https://schema.org/contributor",
          valueKind: "node",
          datatypeIri: "http://www.w3.org/2001/XMLSchema#string",
        },
      ],
    }),
    false,
  )
})

test("Semantic V1 objects reject unknown properties and relative identifier candidates", () => {
  assert.equal(isValid({ bindings: [literalBinding()], unknown: true }), false)
  assert.equal(
    isValid({ bindings: [literalBinding({ predicate: "https://schema.org/name" })] }),
    true,
  )
  assert.equal(
    isValid({ bindings: [literalBinding({ predicate: "/relative/name" })] }),
    false,
  )
  assert.equal(
    isValid({ bindings: [literalBinding({ fieldPointer: "properties/title" })] }),
    false,
  )
})
