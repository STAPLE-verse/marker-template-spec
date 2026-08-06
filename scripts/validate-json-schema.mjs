import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

const repositoryRoot = process.cwd()

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

const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: true })
addFormats(ajv)

const schemaFiles = (await findJsonFiles(path.join(repositoryRoot, "schemas"))).filter((file) =>
  file.endsWith(".schema.json"),
)

for (const file of schemaFiles) {
  const schema = await readJson(file)
  if (!ajv.validateSchema(schema)) {
    throw new Error(`${path.relative(repositoryRoot, file)} is not valid JSON Schema 2020-12`)
  }
  ajv.addSchema(schema)
}

console.log(`Validated ${schemaFiles.length} normative JSON Schema file(s)`)
