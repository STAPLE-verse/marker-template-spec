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

After V1 is declared normative, a breaking contract change requires a new
profile version and new canonical identifiers. Published versioned schemas must
remain available.

## Non-normative changes

Examples, explanatory text, and repository validation tooling may improve
without changing the contract. They must not contradict the normative
specification.

## Pull request checks

Run:

```bash
npm run check
```

Do not introduce a canonical URI until the project controls and can preserve
the target HTTPS location.
