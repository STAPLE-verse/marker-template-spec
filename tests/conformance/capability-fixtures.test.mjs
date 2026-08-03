import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import Ajv from "ajv"
import addFormats from "ajv-formats"

const fixtureRoot = path.join(
  process.cwd(),
  "fixtures",
  "v1",
  "capabilities",
)
const allowedStatuses = new Set([
  "pass",
  "lossy",
  "unsupported",
  "blocked",
  "unverified",
])
const requiredTargets = new Set([
  "rjsfRendering",
  "formStudioAuthoring",
  "stapleDeployment",
])

async function readFixtures() {
  const files = (await readdir(fixtureRoot))
    .filter((file) => file.endsWith(".json"))
    .sort()

  return Promise.all(
    files.map(async (file) => ({
      file,
      fixture: JSON.parse(await readFile(path.join(fixtureRoot, file), "utf8")),
    })),
  )
}

test("capability fixtures have a stable, focused structure", async () => {
  const fixtures = await readFixtures()
  const ids = new Set()

  assert.ok(fixtures.length > 0, "at least one capability fixture is required")

  for (const { file, fixture } of fixtures) {
    assert.equal(fixture.id, path.basename(file, ".json"))
    assert.equal(typeof fixture.description, "string")
    assert.equal(typeof fixture.schema, "object")
    assert.equal(fixture.schema.$schema, "http://json-schema.org/draft-07/schema#")
    assert.equal(typeof fixture.uiSchema, "object")
    assert.ok(Array.isArray(fixture.instances?.valid))
    assert.ok(Array.isArray(fixture.instances?.invalid))
    assert.ok(fixture.instances.valid.length > 0)
    assert.ok(fixture.instances.invalid.length > 0)
    assert.equal(typeof fixture.expectations, "object")

    for (const target of requiredTargets) {
      assert.ok(fixture.expectations[target], `${file} is missing ${target}`)
    }

    for (const [target, expectation] of Object.entries(fixture.expectations)) {
      assert.ok(
        allowedStatuses.has(expectation.status),
        `${file} has unknown ${target} status ${expectation.status}`,
      )
      assert.equal(typeof expectation.reason, "string")
      assert.ok(expectation.reason.length > 0)
    }

    assert.ok(!ids.has(fixture.id), `duplicate fixture id ${fixture.id}`)
    ids.add(fixture.id)
  }
})

test("capability fixture instances exercise their draft-07 schemas", async () => {
  const fixtures = await readFixtures()

  for (const { file, fixture } of fixtures) {
    const ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: true,
      logger: false,
    })
    addFormats(ajv)
    const validate = ajv.compile(fixture.schema)

    for (const example of fixture.instances.valid) {
      assert.equal(
        validate(example.data),
        true,
        `${file}: expected valid instance "${example.label}": ${JSON.stringify(validate.errors)}`,
      )
    }

    for (const example of fixture.instances.invalid) {
      assert.equal(
        validate(example.data),
        false,
        `${file}: expected invalid instance "${example.label}"`,
      )
    }
  }
})
