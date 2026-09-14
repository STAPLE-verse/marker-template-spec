# MARKER Metadata Template Specification

This repository is the implementation-independent source for the MARKER
Metadata Template Specification, its machine-readable schemas, conformance
fixtures, and examples.

## Status

Core V1 and Semantic V1 are **production-stable V1**, declared final as
`v1.0.0`. Their profile URIs, schemas, package vocabulary, validation rules,
diagnostics, and Semantic V1 projection algorithm define the normative
contract of this release.

`v1.0.0` carries no contract changes beyond `v1.0.0-rc.4` — the candidate
period (`v1.0.0-rc.1` through `rc.4`) produced the integration findings that
shaped Core V1 and Semantic V1; final V1 freezes that content rather than
introducing new changes at declaration time. Consumers must pin an exact
released version. A breaking contract change after `v1.0.0` requires a new
profile version and new canonical identifiers, per [CONTRIBUTING.md](CONTRIBUTING.md).

Core V1 is defined in [`spec/v1/README.md`](spec/v1/README.md). Semantic V1's
processing model, field resolution, node ownership, literal defaults,
projection behavior, and deferred features are defined in
[`spec/semantic/v1/README.md`](spec/semantic/v1/README.md).

## Repository contents

```text
spec/       Human-readable normative specification
schemas/    Machine-readable normative schemas
fixtures/   Valid, invalid, and application-capability fixtures
examples/   Explanatory, non-normative examples
implementations/ Optional, non-normative language implementations
scripts/    Repository validation and generation tools
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

The specification itself is not an npm package. Released specifications,
schemas, algorithms, diagnostics, and fixtures remain versioned,
implementation-independent artifacts.

The repository additionally contains an optional TypeScript implementation in
[`implementations/typescript`](implementations/typescript). It provides the
portable Core and Semantic validation and Semantic projection logic needed by
JavaScript applications. It is an implementation of the contract, not an
additional source of normative requirements. Non-JavaScript consumers may
implement the same contract and verify it against the same fixtures.

The runtime package remains private. Published builds during the candidate
period (`v1.0.0-rc.1` through `rc.4`) used the matching exact prerelease
version under a prerelease tag such as `rc` or `next`, never `latest`. The
first stable build, `@staple-verse/marker-template-runtime@1.0.0`, may now
carry the `latest` tag. Its version identifies the runtime release, while its
documentation declares which profile release it implements. Application
database access, authorization, persistence, rendering, and legacy migration
remain outside this repository.

During integration, applications must consume a released runtime version. A
sibling checkout, mutable Git branch, or untracked `node_modules` symlink is
not a reproducible application dependency.

## Validation

Run the complete repository suite with Node.js 20 or newer:

```bash
npm ci
npm run check
```

The validation command first builds the TypeScript runtime. `validate:schema`
checks the normative JSON Schema artifacts. `validate:rules`
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

The repository's public-release license must be selected before distributing
the first tagged release candidate. That administrative choice does not alter
Core or Semantic conformance.
