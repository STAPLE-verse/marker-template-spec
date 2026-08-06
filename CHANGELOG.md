# Changelog

All notable changes to the MARKER Metadata Template Specification will be
documented here.

## Unreleased

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
