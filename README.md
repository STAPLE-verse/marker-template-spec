# MARKER Metadata Template Specification

This repository is the implementation-independent source for the MARKER
Metadata Template Specification, its machine-readable schemas, conformance
fixtures, and examples.

## Status

The specification is an early draft. It is not normative and must not yet be
used as a stable interoperability contract.

Before Core V1 can become normative, the project must freeze:

- the canonical specification URI;
- the MARKER Template Document Schema `$id`;
- the document property names and lifecycle-specific metadata requirements;
- the supported form JSON Schema and RJSF `uiSchema` profiles; and
- the conformance fixtures and expected diagnostics.

No `example.org` identifier may be persisted or published as a canonical
identifier.

## Repository contents

```text
spec/       Human-readable specification
schemas/    Machine-readable schemas
fixtures/   Valid and invalid conformance fixtures
examples/   Explanatory, non-normative examples
scripts/    Repository validation used by CI
tests/      Non-JSON-Schema conformance checks
```

The normative specification and schemas define the contract. Repository tests
check that the maintained artifacts implement that contract, but do not add
requirements of their own.

## Distribution

This repository is not an npm package and does not distribute a runtime
validation library. Released specifications and schemas will be published as
versioned, implementation-independent files. MARKER, STAPLE, and third-party
consumers can validate documents with a JSON Schema implementation appropriate
to their language or framework.

The root `package.json` exists only to provide reproducible development and CI
commands.

## Validation

The repository uses two validation layers:

1. `npm run validate:schema` checks that schemas are valid JSON Schema 2020-12
   documents, valid fixtures pass, invalid fixtures fail, and JSON examples
   pass.
2. `npm run validate:rules` checks profile rules that cannot be expressed
   reliably in JSON Schema, such as cross-component references and application
   compatibility.

Ajv is an implementation detail of this repository's CI. Consumers are not
required to use Ajv or JavaScript.

## Development

```bash
npm ci
npm run check
```

Node.js 20 or newer is required.

## Licensing

The licenses for the normative specification, schemas, fixtures, and
repository validation code must be selected before the first public release.
