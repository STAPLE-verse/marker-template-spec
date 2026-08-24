# Semantic V1 component schema

`semantics.schema.json` is the normative JSON Schema 2020-12 vocabulary for
the optional `semantics` component reserved by Core V1.

Its stable `$id` is:

```text
https://staplescience.com/schemas/marker-template/semantic/v1/semantics.schema.json
```

The schema defines the closed component shape, optional root class, binding
array, the `literal`, `iri`, and `node` discriminators, kind-specific
properties, and exact local value-mapping entry shape. It does not validate
rules that depend on `form.schema` or relationships among bindings.

Complete Semantic V1 validation additionally checks:

- absolute IRI syntax;
- RFC 6901 field-pointer syntax and resolution through local `$ref` values;
- one binding per field pointer;
- binding compatibility with the effective Core field type and format;
- exact mapping-source uniqueness and enum coverage;
- node containment and nearest-parent ownership; and
- missing, invalid, self-referential, or cyclic `parentNodePointer` values.

The optional TypeScript implementation of those rules and stable diagnostics is
in
[`implementations/typescript/src/semantic.ts`](../../../implementations/typescript/src/semantic.ts).

The Core package schema deliberately does not `$ref` this schema. Core treats
the component as opaque and dispatches it to the Semantic V1 validator when
the Semantic V1 profile URI is declared.
