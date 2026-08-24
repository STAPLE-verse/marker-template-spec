# Core V1 conformance tests

The suite implements the normative validation stages that are not expressible
solely by the outer package schema:

- draft-07 validation of `/form/schema`;
- the supported form keyword, format, reference, and array subset;
- UI-schema references and order integrity;
- lifecycle identity and timestamp rules;
- RFC 6901 field-address validation; and
- separate Semantic V1 dispatch;
- Semantic V1 component-shape validation; and
- Semantic V1 field resolution, binding compatibility, exact mapping, and node
  ownership rules; and
- deterministic, atomic Semantic V1 expanded JSON-LD projection.

Invalid fixtures fix the first expected diagnostic's `stage`, `code`, and
package `pointer`. Portable Semantic V1 fixtures fix complete projection inputs,
expanded JSON-LD results, and diagnostics. Capability tests retain the
versioned evidence consumed by Form Studio and STAPLE.

The tests import `@staple-verse/marker-template-runtime` from the repository
workspace. This makes the typed runtime the single executable implementation
under test while the schemas, algorithms, diagnostics, and fixtures remain the
normative contract.
