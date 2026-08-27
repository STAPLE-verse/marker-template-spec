# Contributing

The repository separates normative contract changes from implementation
changes.

## Normative changes

Changes to `spec/` or `schemas/` may change what it means to conform to the
MARKER Metadata Template Specification. A normative pull request should:

1. describe the compatibility impact;
2. update the human-readable specification and machine-readable schemas
   together;
3. add or update valid and invalid fixtures;
4. document expected diagnostics; and
5. state whether the change is compatible with the current profile version.

During the release-candidate period, a breaking contract change requires a new
immutable prerelease tag, updated fixtures and changelog, and explicit consumer
upgrades. Consumers must pin an exact candidate rather than a branch or moving
tag. After final `v1.0.0` is declared, a breaking contract change requires a
new profile version and new canonical identifiers. Published candidate and
final versioned artifacts must remain available.

## Release candidates

Candidate releases use tags such as `v1.0.0-rc.1` and are marked as
prereleases. The TypeScript runtime uses the matching prerelease version and is
published under `rc` or `next`, never `latest`. A candidate is promoted to
final V1 only after clean, pinned integrations pass in this order:

1. STAPLE;
2. Form Studio; and
3. MARKER.

Integration failures may reveal specification defects, but application-specific
database, UI, or migration behavior must not be added to the portable contract.

## Non-normative changes

Examples, explanatory text, and repository validation tooling may improve
without changing the contract. They must not contradict the normative
specification.

The TypeScript runtime is non-normative. A runtime change must remain compatible
with the normative schemas, algorithms, diagnostics, and portable fixtures. A
runtime bug fix does not by itself create a new profile version.

## Pull request checks

Run:

```bash
npm run check
```

Do not introduce a canonical URI until the project controls and can preserve
the target HTTPS location.
