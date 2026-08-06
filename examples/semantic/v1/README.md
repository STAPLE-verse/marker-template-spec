# Semantic V1 design examples

> **Status:** Non-normative explanatory examples with normative expected
> projection results. These files exercise the Semantic V1 component schema,
> cross-component validator, and reference projector.

Each JSON file is one complete projection scenario containing:

- a Core V1 `template` package with a schema-valid `semantics` component;
- a `response` that validates against `template.form.schema`;
- `projectionInput`, including a runtime root IRI when the scenario uses one;
- `expectedExpandedJsonLd`; and
- explicit expected Core, instance, semantic, and projection diagnostics.

The five examples exercise this normative component vocabulary:

- `semantics.root.classIri` optionally types the root instance node;
- `semantics.bindings` contains field bindings;
- every binding has `fieldPointer`, `predicate`, and the `valueKind`
  discriminator;
- `valueKind` is `literal`, `iri`, or `node`;
- a binding emitted from a nested node identifies its owner with
  `parentNodePointer`;
- a `node` binding may declare `classIri`; and
- an `iri` binding may declare exact `valueMappings`, represented as an array
  of `{ "value": <JSON scalar>, "iri": <absolute IRI> }` entries so JSON value
  types remain distinguishable.

The normative component shape is defined by
[`semantics.schema.json`](../../../schemas/semantic/v1/semantics.schema.json),
not by these examples. Cross-component diagnostics are executed by the
reference Semantic V1 validator, and expected expanded JSON-LD is executed by
the reference projector.

## Scenarios

1. `01-basic-title-literal.json` projects a title from a blank root node.
2. `02-date-default-datatype.json` applies the default XSD date datatype.
3. `03-direct-orcid-iri.json` projects a stored absolute ORCID IRI.
4. `04-local-value-to-iri-mapping.json` maps an exact local string value to an
   IRI.
5. `05-repeated-contributors-local-ref.json` combines an object array, local
   `$ref`, `node`, nested `literal` and `iri` bindings, and
   `parentNodePointer`.

Template metadata is intentionally absent from the field-derived graphs. The
collecting application keeps every response associated with the exact Core V1
package, whose `metadata.versionId` identifies the template version.
