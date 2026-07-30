import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

const repositoryRoot = process.cwd()
const schemasRoot = path.join(repositoryRoot, "schemas")
const fixturesRoot = path.join(repositoryRoot, "fixtures")
const examplesRoot = path.join(repositoryRoot, "examples")

async function findJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      return entry.isDirectory() ? findJsonFiles(entryPath) : [entryPath]
    }),
  )

  return files.flat().filter((file) => file.endsWith(".json")).sort()
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"))
  } catch (error) {
    throw new Error(`${relativePath(file)} is not valid JSON`, { cause: error })
  }
}

function relativePath(file) {
  return path.relative(repositoryRoot, file)
}

function fixtureVersion(file, root) {
  return path.relative(root, file).split(path.sep)[0]
}

function formatErrors(errors) {
  return errors
    ?.map(
      (error) =>
        `  ${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
    )
    .join("\n")
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true,
})
addFormats(ajv)

const schemaFiles = (await findJsonFiles(schemasRoot)).filter((file) =>
  file.endsWith(".schema.json"),
)
const schemasByPath = new Map()

for (const file of schemaFiles) {
  const schema = await readJson(file)

  if (!ajv.validateSchema(schema)) {
    throw new Error(
      `${relativePath(file)} is not a valid JSON Schema 2020-12 document:\n` +
        formatErrors(ajv.errors),
    )
  }

  schemasByPath.set(file, schema)
  ajv.addSchema(schema, relativePath(file))
}

const validDocuments = [
  ...(await findJsonFiles(path.join(fixturesRoot))).filter(
    (file) =>
      file.includes(`${path.sep}valid${path.sep}`) &&
      !file.endsWith(".expected.json"),
  ),
  ...(await findJsonFiles(examplesRoot)).filter(
    (file) => !file.endsWith(".expected.json"),
  ),
]

const invalidDocuments = (await findJsonFiles(fixturesRoot)).filter(
  (file) =>
    file.includes(`${path.sep}invalid${path.sep}`) &&
    !file.endsWith(".expected.json"),
)

async function validateDocument(file, expectedValid, root) {
  const version = fixtureVersion(file, root)
  const rootSchemaPath = path.join(
    schemasRoot,
    version,
    "marker-template.schema.json",
  )
  const rootSchema = schemasByPath.get(rootSchemaPath)

  if (!rootSchema) {
    throw new Error(
      `${relativePath(file)} has no corresponding ${relativePath(rootSchemaPath)}`,
    )
  }

  const validate = ajv.compile(rootSchema)
  const valid = validate(await readJson(file))

  if (valid !== expectedValid) {
    const expectation = expectedValid ? "valid" : "invalid"
    throw new Error(
      `${relativePath(file)} was expected to be ${expectation}` +
        (validate.errors ? `:\n${formatErrors(validate.errors)}` : ""),
    )
  }
}

for (const file of validDocuments) {
  const root = file.startsWith(fixturesRoot) ? fixturesRoot : examplesRoot
  await validateDocument(file, true, root)
}

for (const file of invalidDocuments) {
  await validateDocument(file, false, fixturesRoot)
}

console.log(
  [
    `Validated ${schemaFiles.length} JSON Schema file(s)`,
    `${validDocuments.length} valid document(s)`,
    `${invalidDocuments.length} invalid document(s)`,
  ].join(", "),
)
