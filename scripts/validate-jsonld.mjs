import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import jsonld from "jsonld"
import { projectSemanticV1 } from "./semantic-v1-projector.mjs"

const repositoryRoot = process.cwd()
const scenarioRoots = [
  path.join(repositoryRoot, "examples", "semantic", "v1"),
  path.join(repositoryRoot, "fixtures", "semantic", "v1", "projection"),
]

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

async function offlineDocumentLoader(url) {
  throw new Error(`JSON-LD validation attempted to load remote document ${url}`)
}

async function canonicalize(document) {
  return jsonld.canonize(document, {
    algorithm: "RDFC-1.0",
    format: "application/n-quads",
    documentLoader: offlineDocumentLoader,
  })
}

let validatedGraphs = 0
let skippedFailures = 0

for (const root of scenarioRoots) {
  for (const file of await findJsonFiles(root)) {
    const scenario = await readJson(file)
    const relativeFile = path.relative(repositoryRoot, file)
    const expected = scenario.expectedExpandedJsonLd
    const actual = projectSemanticV1(
      scenario.template,
      scenario.response,
      scenario.projectionInput,
    )

    if (expected === null) {
      assert.equal(actual.expandedJsonLd, null, `${relativeFile} must fail projection`)
      assert.ok(
        actual.diagnostics.length > 0,
        `${relativeFile} must explain projection failure`,
      )
      skippedFailures += 1
      continue
    }

    assert.ok(Array.isArray(expected), `${relativeFile} must contain an expanded array`)
    assert.deepEqual(
      actual.diagnostics,
      scenario.expectedProjectionDiagnostics ??
        scenario.expectedDiagnostics?.projection ??
        [],
      `${relativeFile} projection diagnostics`,
    )

    let independentlyExpanded
    try {
      independentlyExpanded = await jsonld.expand(expected, {
        documentLoader: offlineDocumentLoader,
      })
    } catch (error) {
      throw new Error(`${relativeFile} is not valid JSON-LD 1.1`, { cause: error })
    }

    const [expectedGraph, expandedGraph, actualGraph] = await Promise.all([
      canonicalize(expected),
      canonicalize(independentlyExpanded),
      canonicalize(actual.expandedJsonLd),
    ])
    assert.equal(
      expandedGraph,
      expectedGraph,
      `${relativeFile} changes meaning when independently expanded`,
    )
    assert.equal(
      actualGraph,
      expectedGraph,
      `${relativeFile} reference projection is not RDF-graph equivalent`,
    )
    validatedGraphs += 1
  }
}

console.log(
  `Independently validated ${validatedGraphs} expanded JSON-LD graph(s); ` +
    `checked ${skippedFailures} expected projection failure(s)`,
)
