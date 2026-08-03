# V1 capability fixtures

These small fixtures are non-normative probes for form capabilities being
considered for MARKER Template Profile V1. They are intentionally independent
of the unfinished outer MARKER template-document shape.

Each JSON file contains one focused draft-07 `schema`, its RJSF `uiSchema`,
valid and invalid metadata-instance examples, and observed or intended
compatibility expectations for the current application stack.

Expectation statuses mean:

- `pass`: the application can perform the named operation safely;
- `lossy`: it loads the fixture but changes meaning or presentation;
- `unsupported`: it cannot provide the named operation;
- `blocked`: known application behavior prevents correct use; and
- `unverified`: an executable result has not been established yet.

The three required expectation targets are `rjsfRendering`,
`formStudioAuthoring`, and `stapleDeployment`. A fixture may add another target
when it probes a separate concern, such as semantic interpretation.

Preservation-sensitive fixtures use the optional `formStudioPreservation`
target to distinguish lossless pass-through from visual editing support. A
construct may therefore be `unsupported` for visual authoring while still
being required to pass round-trip preservation.

These expectations do not decide Core conformance. The fixtures become
normative only after the V1 Core and application-compatibility rules are
frozen.

## Initial version matrix

The first executable compatibility checks must cover every path currently in
use:

| Execution path | Version coordinates |
| --- | --- |
| MARKER Form Studio authoring and preview | Form Studio `0.1.0` at commit `d62d345e4d211b1093fc4f5d573430026957334e`, bundling RJSF and validator `6.6.2` with AJV `8.20.0` |
| STAPLE Form Studio authoring and preview | The same Form Studio build and bundled validation stack |
| STAPLE deployed metadata collection | RJSF and validator `5.13.4`, AJV `8.17.1`, and `ajv-formats` `2.1.1` |

These coordinates describe current test environments rather than permanent
requirements of MARKER Core V1. Every generated compatibility result must
record the versions that produced it.

`stapleDeployment` is a versioned integration expectation, not a MARKER Core
or MARKER Application Compatibility conformance class. It describes behavior
of the identified STAPLE release or commit. Failure may prevent deployment in
that STAPLE version, but it does not make the template non-conformant. A stable
STAPLE deployment profile may be defined separately if it becomes necessary.

## Executable consumers

- Form Studio runs RJSF 6 rendering and visual read/write round-trip checks
  with `npm test`.
- STAPLE runs its RJSF 5 preprocessing, rendering, and instance-validation
  integration checks with `npm run test:marker-template-capabilities`.

Both consumers read this directory through `MARKER_TEMPLATE_SPEC_ROOT`. Local
development falls back to a sibling `marker-template-spec` checkout. Cross-repository
CI wiring is deferred until the V1 fixture suite has a commit or release that
the consuming application can pin explicitly.

Initial fixtures:

| Fixture | Primary capability or known gap |
| --- | --- |
| `required-string` | Minimal required text field |
| `numeric-constraints` | Integer and number constraints |
| `boolean-field` | Boolean checkbox |
| `enum-choice` | Enumerated choice |
| `standard-formats` | Date, email, and URI formats |
| `textarea-widget` | Portable multiline presentation in `uiSchema` |
| `legacy-textarea-format` | Non-standard STAPLE `format: "textarea"` |
| `legacy-hidden-readonly-field` | Hidden read-only schema marker used by STAPLE built-ins |
| `scalar-array` | Repeatable scalar field |
| `object-array` | Repeatable structured section |
| `nested-object` | Nested object section |
| `local-reference` | Draft-07 `definitions` and local `$ref` |
| `conditional-if-then` | `allOf` with `if`/`then` |
| `legacy-dependencies` | Draft-07 value-dependent schema |
| `one-of-choice` | Standalone `oneOf` composition |
