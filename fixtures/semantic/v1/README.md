# Semantic V1 portable projection fixtures

These fixtures are implementation-independent inputs and expected results for
Semantic V1 projection. A consumer can run the same files through an
implementation in any programming language.

Every fixture contains:

- `id` and `description`;
- `conformance`, classified as `valid`, `invalid`, or `defensive`;
- a complete Core V1 `template` package;
- a `response` and optional `projectionInput`;
- `responseConformsToFormSchema`;
- `expectedExpandedJsonLd`, which is `null` on projection failure; and
- the exact `expectedProjectionDiagnostics`.

Directories have these meanings:

- `projection/valid` contains conforming response projections.
- `projection/invalid` contains Core- and Semantic-valid inputs that fail only
  at projection time, such as invalid runtime IRIs or unmapped values.
- `projection/defensive` records deterministic hardening behavior outside the
  conforming-input contract.

`null-bound-value.json` is defensive because a bound Core V1 scalar field does
not accept `null`; conforming callers reject that response before projection.
The reference projector nevertheless omits `null` rather than inventing a
literal value.
