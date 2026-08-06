import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import Ajv from "ajv"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"
import {
  SEMANTIC_PROFILE_URI,
  validateCoreV1,
} from "../../scripts/core-v1-conformance.mjs"
import { validateSemanticV1 } from "../../scripts/semantic-v1-conformance.mjs"
import { projectSemanticV1 } from "../../scripts/semantic-v1-projector.mjs"

const exampleRoot = path.join(process.cwd(), "examples", "semantic", "v1")
const semanticSchemaPath = path.join(
  process.cwd(),
  "schemas",
  "semantic",
  "v1",
  "semantics.schema.json",
)

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"))
}

test("Semantic V1 design examples contain Core-valid templates and valid responses", async () => {
  const semanticAjv = new Ajv2020({ allErrors: true, strict: true })
  const validateSemanticComponent = semanticAjv.compile(await readJson(semanticSchemaPath))
  const files = (await readdir(exampleRoot))
    .filter((file) => file.endsWith(".json"))
    .sort()

  assert.deepEqual(files, [
    "01-basic-title-literal.json",
    "02-date-default-datatype.json",
    "03-direct-orcid-iri.json",
    "04-local-value-to-iri-mapping.json",
    "05-repeated-contributors-local-ref.json",
  ])

  for (const file of files) {
    const example = await readJson(path.join(exampleRoot, file))
    const {
      template,
      response,
      projectionInput,
      expectedExpandedJsonLd,
      expectedDiagnostics,
    } = example

    assert.equal(typeof example.id, "string", `${file} must have an id`)
    assert.deepEqual(validateCoreV1(template), [], `${file} must contain a Core-valid template`)
    assert.ok(
      template.conformsTo.includes(SEMANTIC_PROFILE_URI),
      `${file} must declare Semantic V1`,
    )
    assert.equal(
      validateSemanticComponent(template.semantics),
      true,
      `${file} semantics must validate: ${JSON.stringify(validateSemanticComponent.errors)}`,
    )

    const instanceAjv = new Ajv({ allErrors: true, strict: false })
    addFormats(instanceAjv)
    const validateInstance = instanceAjv.compile(template.form.schema)
    assert.equal(
      validateInstance(response),
      true,
      `${file} response must validate: ${JSON.stringify(validateInstance.errors)}`,
    )

    const semanticDiagnostics = validateSemanticV1(template)
    assert.deepEqual(
      semanticDiagnostics,
      expectedDiagnostics.semanticValidation,
      `${file} semantic diagnostics must match`,
    )

    const projection = projectSemanticV1(template, response, projectionInput)
    assert.deepEqual(
      projection.diagnostics,
      expectedDiagnostics.projection,
      `${file} projection diagnostics must match`,
    )
    assert.deepEqual(
      projection.expandedJsonLd,
      expectedExpandedJsonLd,
      `${file} expanded JSON-LD must match`,
    )

    assert.deepEqual(expectedDiagnostics.coreValidation, [])
    assert.deepEqual(expectedDiagnostics.instanceValidation, [])
  }
})
