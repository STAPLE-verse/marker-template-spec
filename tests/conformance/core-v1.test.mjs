import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import {
  CORE_PROFILE_URI,
  FORM_SCHEMA_DIALECT,
  PACKAGE_SCHEMA_ID,
  SEMANTIC_PROFILE_URI,
  validateCoreV1,
  validateSemantics,
  validateFieldPointer,
} from "@staple-verse/marker-template-runtime"

const repositoryRoot = process.cwd()
const fixtureRoot = path.join(repositoryRoot, "fixtures", "v1")
const exampleRoot = path.join(repositoryRoot, "examples", "v1")

async function findJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name)
      return entry.isDirectory() ? findJsonFiles(entryPath) : [entryPath]
    }),
  )
  return nested.flat().filter((file) => file.endsWith(".json")).sort()
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"))
}

test("normative identifiers and dialect are frozen", async () => {
  const schema = await readJson(
    path.join(repositoryRoot, "schemas", "v1", "marker-template.schema.json"),
  )
  assert.equal(schema.$id, PACKAGE_SCHEMA_ID)
  assert.equal(schema.required.includes("$schema"), false)
  assert.equal(schema.properties.conformsTo.contains.const, CORE_PROFILE_URI)
  assert.equal(FORM_SCHEMA_DIALECT, "http://json-schema.org/draft-07/schema#")
})

test("valid fixtures and examples conform to Core V1", async () => {
  const files = [
    ...(await findJsonFiles(path.join(fixtureRoot, "valid"))),
    ...(await findJsonFiles(exampleRoot)),
  ].filter((file) => !file.endsWith(".expected.json"))

  assert.ok(files.length >= 3)
  for (const file of files) {
    assert.deepEqual(
      validateCoreV1(await readJson(file)),
      [],
      path.relative(repositoryRoot, file),
    )
  }
})

test("invalid fixtures produce their normative first diagnostic", async () => {
  const files = (await findJsonFiles(path.join(fixtureRoot, "invalid"))).filter(
    (file) => !file.endsWith(".expected.json"),
  )

  assert.ok(files.length >= 4)
  for (const file of files) {
    const expected = await readJson(file.replace(/\.json$/u, ".expected.json"))
    const [actual] = validateCoreV1(await readJson(file))
    assert.ok(actual, `${path.relative(repositoryRoot, file)} unexpectedly conformed`)
    assert.deepEqual(
      { stage: actual.stage, code: actual.code, pointer: actual.pointer },
      expected,
      path.relative(repositoryRoot, file),
    )
  }
})

test("RFC 6901 field pointers address instance fields, including array items", async () => {
  const fixture = await readJson(
    path.join(fixtureRoot, "valid", "published-research-data.json"),
  )
  const schema = fixture.form.schema

  assert.equal(validateFieldPointer(schema, "/properties/title"), true)
  assert.equal(validateFieldPointer(schema, "/properties/contact/properties/email"), true)
  assert.equal(
    validateFieldPointer(schema, "/properties/contributors/items/properties/orcid"),
    true,
  )
  assert.equal(validateFieldPointer(schema, "/definitions/nonEmptyString"), false)
  assert.equal(validateFieldPointer(schema, "/properties/missing"), false)

  const escapedSchema = {
    properties: {
      "name/with~tokens": { type: "string" },
    },
  }
  assert.equal(
    validateFieldPointer(escapedSchema, "/properties/name~1with~0tokens"),
    true,
  )
})

test("package identity keywords and Semantic V1 declarations stay at their agreed boundaries", async () => {
  const draft = await readJson(path.join(fixtureRoot, "valid", "minimal-draft.json"))

  const withOuterSchema = structuredClone(draft)
  withOuterSchema.$schema = PACKAGE_SCHEMA_ID
  assert.equal(validateCoreV1(withOuterSchema)[0]?.pointer, "/$schema")

  const draftWithPublishedAt = structuredClone(draft)
  draftWithPublishedAt.metadata.publishedAt = "2026-08-05T09:00:00Z"
  assert.equal(validateCoreV1(draftWithPublishedAt)[0]?.pointer, "/metadata/publishedAt")

  const semanticsWithoutProfile = structuredClone(draft)
  semanticsWithoutProfile.semantics = {}
  assert.equal(validateCoreV1(semanticsWithoutProfile)[0]?.pointer, "/conformsTo/0")

  const profileWithoutSemantics = structuredClone(draft)
  profileWithoutSemantics.conformsTo.push(SEMANTIC_PROFILE_URI)
  assert.equal(validateCoreV1(profileWithoutSemantics)[0]?.pointer, "/semantics")
})

test("Semantic V1 is dispatched separately and stays explicit until recognized", async () => {
  const fixture = await readJson(
    path.join(exampleRoot, "core-with-semantics.json"),
  )

  assert.deepEqual(validateCoreV1(fixture), [])
  assert.deepEqual(validateSemantics(fixture), {
    profile: SEMANTIC_PROFILE_URI,
    status: "unrecognized",
    diagnostics: [],
  })

  assert.deepEqual(
    validateSemantics(fixture, (payload) =>
      Object.keys(payload).length === 0
        ? [{ code: "TEST_SEMANTIC_PAYLOAD", pointer: "/semantics" }]
        : [],
    ),
    {
      profile: SEMANTIC_PROFILE_URI,
      status: "invalid",
      diagnostics: [{ code: "TEST_SEMANTIC_PAYLOAD", pointer: "/semantics" }],
    },
  )
})
