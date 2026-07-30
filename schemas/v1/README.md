# V1 machine-readable schemas

This directory is reserved for the schemas that implement the normative V1
contract, including the MARKER Template Document Schema and supporting
component schemas.

No schema is committed yet because the canonical `$id`, package vocabulary,
metadata requirements, and dialect decisions are still open. Draft schemas
must be clearly marked non-normative and must not use a placeholder as a
published identifier.

The root V1 schema will be named `marker-template.schema.json` and will declare
the JSON Schema 2020-12 dialect. Supporting schemas may be added beside it and
referenced with `$ref`.
