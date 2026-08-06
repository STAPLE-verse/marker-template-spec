# MARKER Metadata Template Specification

This repository is the implementation-independent source for the MARKER
Metadata Template Specification, its machine-readable schemas, conformance
fixtures, and examples.

## Status

Core V1 is normative. Its profile URI, package-schema `$id`, package property
names, embedded form dialect, lifecycle metadata, field-addressing rules, and
semantic boundary are frozen in [`spec/v1/README.md`](spec/v1/README.md).

Semantic V1's component vocabulary, JSON Schema, cross-component validation,
expanded JSON-LD projection algorithm, and diagnostics are normative.
Core reserves `/semantics` and dispatches it separately. The processing model,
field resolution, node ownership, literal defaults, and deferred features are
recorded in the [`Semantic V1 scope draft`](spec/semantic/v1/README.md).

## Repository contents

```text
spec/       Human-readable normative specification
schemas/    Machine-readable normative schemas
fixtures/   Valid, invalid, and application-capability fixtures
examples/   Explanatory, non-normative examples
scripts/    Staged conformance validation used by CI
tests/      Profile and cross-component conformance checks
```

The normative specification and schemas define the contract. Repository tests
check that the maintained artifacts implement that contract, but do not add
requirements of their own.

## Stable identifiers

- Profile: `https://staplescience.com/profiles/marker-template/core/v1`
- Package schema: `https://staplescience.com/schemas/marker-template/core/v1/package.schema.json`
- Form-schema dialect: `http://json-schema.org/draft-07/schema#`
- Semantic profile: `https://staplescience.com/profiles/marker-template/semantic/v1`
- Semantic component schema: `https://staplescience.com/schemas/marker-template/semantic/v1/semantics.schema.json`

## Distribution

This repository is not an npm package and does not distribute a runtime
validation library. Released specifications and schemas are versioned,
implementation-independent files. MARKER, STAPLE, and third-party consumers
can validate documents with an appropriate JSON Schema implementation.

Ajv and the scripts in this repository are reference conformance tooling, not
runtime requirements for consumers.

## Validation

Run the complete repository suite with Node.js 20 or newer:

```bash
npm ci
npm run check
```

`validate:schema` checks the normative JSON Schema artifacts. `validate:rules`
checks valid and invalid packages, the Core subset, cross-component references,
field pointers, semantic dispatch and component shape, diagnostic contracts,
design examples, and capability fixtures.

Run the independent JSON-LD 1.1 and RDF-graph check locally with:

```bash
npm run validate:jsonld
```

This command uses a separate standards implementation to expand and
RDFC-1.0-canonicalize the expected and projected graphs without loading remote
contexts. It is kept separate from the default validation command and CI
workflow for now.

Application compatibility is versioned evidence and is run in the consumer
repositories:

```bash
cd ../form-studio && npm test
cd ../STAPLE && npm run test:marker-template-capabilities
```

## Licensing

The repository's public-release license must be selected before distributing a
tagged release. That administrative choice does not alter Core V1 conformance.
