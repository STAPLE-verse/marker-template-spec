# V1 machine-readable schemas

`marker-template.schema.json` is the normative MARKER Core V1 outer-package
schema. Its dialect is JSON Schema 2020-12 and its stable `$id` is:

```text
https://staplescience.com/schemas/marker-template/core/v1/package.schema.json
```

Package instances declare Core conformance through `/conformsTo`; they do not
repeat the validator `$id` in a top-level `$schema` property. The embedded
`/form/schema` is deliberately validated in a separate pass as
JSON Schema draft-07. The outer schema only establishes its canonical location
and JSON object shape; it does not reinterpret it as a 2020-12 subschema.

The separately dispatched Semantic V1 component schema is documented at
[`schemas/semantic/v1/`](../semantic/v1/README.md). The Core package schema does
not reference or inline that independent profile schema.
