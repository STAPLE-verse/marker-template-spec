# Changelog

All notable changes to the MARKER Metadata Template Specification will be
documented here.

## Unreleased

## 1.0.0-rc.3 - 2026-08-28

- Replaced the Semantic V1 component schema's plain `oneOf` over the
  `literal`/`iri`/`node` binding shapes with an `if`/`then`/`else` dispatch
  keyed on the binding's own `valueKind`. A binding is now checked only
  against its one intended kind-specific shape, so an invalid binding (for
  example a malformed `predicate`) produces one relevant
  `SEMANTIC_COMPONENT_INVALID` diagnostic instead of duplicated and
  contradictory errors accumulated from the other two, inapplicable kinds.
  Which documents are valid or invalid is unchanged; only the shape and
  volume of the reported errors for an already-invalid binding improves.
- Filtered AJV's own `if`-keyword wrapper error out of
  `SEMANTIC_COMPONENT_INVALID` diagnostics, since it only restates that the
  dispatched branch failed and always accompanies the branch's own, more
  specific error.

## 1.0.0-rc.2 - 2026-08-27

- Exported `analyzeSemanticV1Bindings` and its `SemanticBindingAnalysis` result
  type from the TypeScript runtime's public entry point, so consumers can
  resolve a Semantic V1 field pointer and its effective Core value type
  without reimplementing the runtime's local-`$ref` and schema-variant
  resolution.
- Added `findAncestorNodeBindings`, a standalone, non-normative query that
  returns the `node` bindings structurally containing a given field pointer,
  nearest first. It shares its containment logic with `validateSemanticV1`'s
  node-ownership check, so the entry it marks `nearest` always agrees with
  what the runtime itself will accept as a conformant `parentNodePointer`.
- Exported the supporting `FieldResolutionStatus`, `JsonSchemaNode`,
  `TypedValueSchema`, and `SemanticAncestorNodeBinding` types alongside the
  above.

## 1.0.0-rc.1 - 2026-08-27

- Classified the complete Core V1 and Semantic V1 contracts as a V1 release
  candidate rather than a production-stable final release.
- Defined exact prerelease pinning and sequential STAPLE, Form Studio, and
  MARKER integration as the promotion gate for final `v1.0.0`.
- Kept application persistence, authorization, rendering, and migration outside
  the portable specification and prohibited mutable sibling-source dependencies
  for reproducible integration releases.
- Froze the normative Core V1 profile and package-schema identifiers under
  `staplescience.com`.
- Defined the `conformsTo`, `metadata`, `form`, and optional `semantics`
  package vocabulary, draft and published metadata, draft-07 form dialect,
  JSON Pointer field addressing, and staged conformance model.
- Unified creator and contributor credit in one contributor list, with the
  reserved `Creator` role and optional identifiers and affiliations.
- Added the normative package schema, valid and invalid fixtures, stable
  diagnostics, semantic dispatch checks, and application compatibility
  evidence.
- Added the lean Semantic V1 profile covering local-reference field resolution,
  explicit node ownership, literal defaults, offline expanded JSON-LD
  projection, and the boundary of deferred semantic features.
- Added five complete, non-normative Semantic V1 design examples covering a
  title literal, default date datatype, direct ORCID IRI, exact local mapping,
  and repeated contributor nodes resolved through a local reference.
- Added the normative Semantic V1 component JSON Schema with closed,
  discriminated `literal`, `iri`, and `node` binding shapes and validated all
  five design examples against it.
- Added executable Semantic V1 cross-component validation and stable
  diagnostics for IRIs, field resolution, effective types, exact mappings, and
  node ownership.
- Added the normative, atomic response-to-expanded-JSON-LD algorithm and
  reference projector, keeping exact-template association in the collecting
  application rather than the semantic graph.
- Added portable projection fixtures and an opt-in local JSON-LD 1.1/RDF graph
  validation command backed by an independent processor.
- Added an optional, strictly typed, browser-safe TypeScript runtime for Core V1
  validation, Semantic V1 cross-component validation, and expanded JSON-LD
  projection. Repository conformance tests now exercise this single
  implementation, replacing the former `.mjs` algorithm files.
