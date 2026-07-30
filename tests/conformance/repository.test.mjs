import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const repositoryRoot = process.cwd()
const normativeRoots = ["schemas", "spec"].map((directory) =>
  path.join(repositoryRoot, directory),
)
const reservedHosts = new Set([
  "example.com",
  "example.net",
  "example.org",
  "localhost",
])

async function findFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      return entry.isDirectory() ? findFiles(entryPath) : [entryPath]
    }),
  )

  return files.flat()
}

function findReservedUri(content) {
  const uriPattern = /https?:\/\/[^\s"'<>`)]+/gu

  for (const match of content.matchAll(uriPattern)) {
    try {
      const uri = new URL(match[0].replace(/[.,;:]$/u, ""))
      if (reservedHosts.has(uri.hostname)) {
        return uri.href
      }
    } catch {
      // Ignore prose fragments that merely resemble a URI.
    }
  }

  return undefined
}

test("normative artifacts do not contain placeholder canonical URIs", async () => {
  for (const root of normativeRoots) {
    for (const file of await findFiles(root)) {
      const reservedUri = findReservedUri(await readFile(file, "utf8"))
      assert.equal(
        reservedUri,
        undefined,
        `${path.relative(repositoryRoot, file)} contains ${reservedUri}`,
      )
    }
  }
})
