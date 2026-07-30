# V1 conformance fixtures

Fixtures will be organized by validation stage and expected result:

```text
valid/                 Documents expected to conform
invalid/package/       Outer document failures
invalid/components/    Form schema or UI schema failures
invalid/cross/         Cross-component integrity failures
invalid/rjsf/          RJSF compatibility failures
invalid/form-studio/   Form Studio round-trip failures
```

Every invalid fixture must declare its expected diagnostic code and JSON
location. Fixtures are part of the conformance contract once V1 becomes
normative.

JSON Schema fixtures use the following convention:

- `valid/**/*.json` must validate against
  `schemas/v1/marker-template.schema.json`;
- `invalid/**/*.json` must fail validation against that schema; and
- files ending in `.expected.json` contain expected diagnostics and are not
  treated as template documents.

Rules that require relationships between components or application-specific
compatibility checks belong in `tests/conformance/`.
