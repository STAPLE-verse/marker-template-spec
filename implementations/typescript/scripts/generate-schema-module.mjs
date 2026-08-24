import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repositoryRoot = path.resolve(packageRoot, "../..")
const generatedDirectory = path.join(packageRoot, "src", "generated")

const schemas = [
  {
    exportName: "coreV1PackageSchema",
    source: path.join(repositoryRoot, "schemas", "v1", "marker-template.schema.json"),
  },
  {
    exportName: "semanticV1ComponentSchema",
    source: path.join(
      repositoryRoot,
      "schemas",
      "semantic",
      "v1",
      "semantics.schema.json",
    ),
  },
]

await mkdir(generatedDirectory, { recursive: true })

const declarations = await Promise.all(
  schemas.map(async ({ exportName, source }) => {
    const schema = JSON.parse(await readFile(source, "utf8"))
    return `export const ${exportName}: Record<string, unknown> = ${JSON.stringify(schema, null, 2)}\n`
  }),
)

await writeFile(
  path.join(generatedDirectory, "schemas.ts"),
  `// Generated from the normative schemas. Do not edit.\n\n${declarations.join("\n")}`,
  "utf8",
)
