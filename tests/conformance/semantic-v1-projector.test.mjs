import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import Ajv from "ajv"
import addFormats from "ajv-formats"
import {
  projectSemanticV1,
  validateCoreV1,
  validateSemanticV1,
} from "@staple-verse/marker-template-runtime"

const fixtureRoot = path.join(
  process.cwd(),
  "fixtures",
  "semantic",
  "v1",
  "projection",
)

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

test("portable Semantic V1 projection fixtures match the TypeScript runtime", async () => {
  const files = await findJsonFiles(fixtureRoot)
  assert.equal(files.length, 6)

  for (const file of files) {
    const fixture = await readJson(file)
    const relativeFile = path.relative(process.cwd(), file)

    assert.ok(["valid", "invalid", "defensive"].includes(fixture.conformance))
    assert.deepEqual(validateCoreV1(fixture.template), [], relativeFile)
    assert.deepEqual(validateSemanticV1(fixture.template), [], relativeFile)

    const instanceAjv = new Ajv({ allErrors: true, strict: false })
    addFormats(instanceAjv)
    const validateInstance = instanceAjv.compile(fixture.template.form.schema)
    assert.equal(
      validateInstance(fixture.response),
      fixture.responseConformsToFormSchema,
      `${relativeFile} response-conformance declaration must match`,
    )

    const actual = projectSemanticV1(
      fixture.template,
      fixture.response,
      fixture.projectionInput,
    )
    assert.deepEqual(
      actual.expandedJsonLd,
      fixture.expectedExpandedJsonLd,
      `${relativeFile} expanded JSON-LD`,
    )
    assert.deepEqual(
      actual.diagnostics,
      fixture.expectedProjectionDiagnostics,
      `${relativeFile} projection diagnostics`,
    )
  }
})

test("projection fails atomically when the Semantic V1 component is absent", () => {
  assert.deepEqual(projectSemanticV1({}, {}), {
    expandedJsonLd: null,
    diagnostics: [
      {
        stage: "semantic-projection",
        code: "PROJECTION_PRECONDITION_FAILED",
        pointer: "/semantics",
        message: "Projection requires a Semantic V1 component",
      },
    ],
  })
})
