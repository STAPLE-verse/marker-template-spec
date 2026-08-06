# MARKER Metadata Template Specification — Semantic V1 Scope

> **Status:** Profile draft. This document defines the boundary, binding
> vocabulary, component JSON Schema, cross-component validation rules, and
> validation diagnostics of a lean Semantic V1 profile. The projection
> algorithm, projection diagnostics, and projection conformance fixtures are
> not yet normative.

Semantic V1 is an optional profile for attaching machine-interpretable meaning
to fields in a Core V1 MARKER metadata-template package and deterministically
projecting a validated metadata instance to expanded JSON-LD. It is deliberately
small: the raw JSON instance remains authoritative, while JSON-LD is a derived
representation that can be regenerated from the exact template version,
semantic bindings, and response.

Semantic V1 uses the profile URI already reserved by Core V1:

```text
https://staplescience.com/profiles/marker-template/semantic/v1
```

The `semantics` component is optional for a Core V1 package, but required for a
package that claims Semantic V1 conformance. When a package contains the
top-level `semantics` component, Core V1 requires this URI in `conformsTo`, and
declaring the URI requires the component. Bindings address fields with Core V1
field pointers rooted at `form.schema`. Semantic annotations MUST NOT be
embedded as invented keywords inside the form schema.

## Processing model

Projection takes:

1. a Core V1-conformant template package with a valid Semantic V1 component;
2. a metadata instance that validates against the package's `form.schema`; and
3. an optional absolute root instance IRI supplied by the runtime.

It produces an offline, deterministic expanded JSON-LD representation. If the
runtime does not supply a root instance IRI, projection uses a blank root node.
Projection never changes the stored metadata response.

```text
Core template + Semantic V1 bindings + validated response + optional root IRI
                                      |
                                      v
                         expanded JSON-LD projection
```

## Field resolution and node ownership

Semantic V1 field pointers retain the RFC 6901 token syntax and instance-field
addressing rules defined by Core V1. Resolution MUST also traverse Core V1
local `$ref` values deterministically. A local reference is transparent while
following an instance-bearing path: the resolver dereferences it against the
root `form.schema` and continues resolving the remaining path in the referenced
schema.

For example, given:

```json
{
  "properties": {
    "contributors": {
      "type": "array",
      "items": { "$ref": "#/definitions/contributor" }
    }
  },
  "definitions": {
    "contributor": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "orcid": { "type": "string", "format": "uri" }
      }
    }
  }
}
```

the instance-bearing field pointers are:

```text
/properties/contributors
/properties/contributors/items/properties/name
/properties/contributors/items/properties/orcid
```

They are not pointers into `/definitions`. A resolver encountering the `$ref`
at `contributors/items` dereferences `#/definitions/contributor` before
resolving `properties/name` or `properties/orcid`. Resolution MUST be offline,
MUST use only Core-conformant local references, and MUST fail with a diagnostic
for an unresolved reference or a reference cycle that prevents resolution.

Every binding MAY contain `parentNodePointer`. The property establishes which
`node` binding owns the subject from which that binding's predicate is emitted:

- a binding without `parentNodePointer` is emitted from the root instance node;
- a binding for a field nested within a bound object or object-array node MUST
  set `parentNodePointer` to the field pointer of its nearest containing `node`
  binding;
- `parentNodePointer` MUST resolve to an existing binding whose value kind is
  `node`;
- the child field MUST be inside the object represented by that node after
  local-reference resolution; and
- self-parenting and parent cycles are invalid.

A nested `node` binding follows the same rule, allowing deterministic trees of
related nodes. Parentage MUST NOT be inferred solely from textual pointer
prefixes.

## Included in Semantic V1

Semantic V1 includes:

- a Core-optional, Semantic-required top-level `semantics` component;
- an optional class IRI for the root node;
- partial annotation, with no requirement to bind every form field;
- one absolute predicate IRI for every binding;
- exactly one binding for a given field pointer;
- explicit node-child ownership through `parentNodePointer`;
- three value kinds: `literal`, `iri`, and `node`;
- literal projection for Core scalar types and supported date, date-time, and
  time formats;
- an optional datatype IRI compatible with the bound field;
- an optional fixed BCP 47 language tag for a compatible literal binding;
- direct absolute IRI values;
- exact, local mappings from stored values to absolute IRIs;
- scalar arrays projected as repeated values;
- object and object-array fields projected as related nodes;
- an optional class IRI for each nested node binding; and
- deterministic, offline expanded JSON-LD projection without dereferencing
  remote resources.

The three value kinds have these roles:

- **`literal`** projects a scalar value as an RDF literal. A compatible fixed
  datatype or language may refine its representation.
- **`iri`** projects either a stored absolute IRI or the result of an exact
  local value-to-IRI mapping as an identified RDF node.
- **`node`** projects an object, or each member of an object array, as a related
  node whose child fields may have their own bindings. Nested nodes are blank
  nodes in V1 and may carry an explicitly declared class IRI.

### Literal projection

In the absence of an explicit datatype or language tag, Semantic V1 uses these
datatype IRIs:

| Core field | Default RDF datatype |
| --- | --- |
| `type: "string"` | `http://www.w3.org/2001/XMLSchema#string` |
| `type: "boolean"` | `http://www.w3.org/2001/XMLSchema#boolean` |
| `type: "integer"` | `http://www.w3.org/2001/XMLSchema#integer` |
| `type: "number"` | `http://www.w3.org/2001/XMLSchema#double` |
| string with `format: "date"` | `http://www.w3.org/2001/XMLSchema#date` |
| string with `format: "date-time"` | `http://www.w3.org/2001/XMLSchema#dateTime` |
| string with `format: "time"` | `http://www.w3.org/2001/XMLSchema#time` |

Other Core string formats project with the XSD string datatype shown above.
Projection preserves the validated JSON value: it MUST NOT trim, case-fold,
parse, or otherwise rewrite strings. Boolean, integer, and number values remain
JSON scalars in expanded JSON-LD with the datatype shown above.

An explicit datatype MUST be an absolute IRI. For boolean, integer, number,
date, date-time, and time fields, V1 permits only the corresponding datatype
shown in the table. An unformatted string field MAY declare another absolute
datatype IRI; Semantic V1 preserves its lexical string but does not dereference
the datatype or verify a custom datatype's lexical space.

A fixed language tag is permitted only for an unformatted string field and
MUST be a structurally valid BCP 47 tag. A literal binding MUST NOT declare both
a datatype and a language tag. A language-tagged value is represented as an RDF
language-tagged string rather than with the XSD string datatype.

Every predicate, class, datatype, mapped value, and supplied instance IRI is
used exactly as written. Semantic V1 does not expand prefixes or compact IRIs:
for example, `https://schema.org/name` identifies the Schema.org predicate,
while `schema:name` would be a different IRI with the scheme `schema` and MUST
NOT be used as shorthand for the Schema.org IRI.

Unbound fields are omitted from JSON-LD and retained unchanged in the raw JSON
instance. Missing values and `null` are omitted. Empty strings, `false`, and
`0` are projected when they are valid response values. Scalar arrays produce
repeated RDF values; V1 assigns no semantic significance to array order.

Projection MUST fail with a diagnostic rather than silently omit or rewrite a
bound value when an IRI is invalid or a value requiring a local mapping is
unmapped. Conformance is based on expanded JSON-LD or RDF-equivalent output,
not JSON property order, formatting, or implementation-assigned blank-node
labels.

Local value-to-IRI mappings use exact equality of parsed JSON scalar type and
value. Implementations MUST NOT coerce types, trim strings, fold case, or parse
string values before matching. Consequently, `"1"` does not match `1`, and
`"true"` does not match `true`; `1` and `1.0` are the same JSON number value.
Mapping entries cannot target `null`, because missing values and `null` are
omitted from projection.

## Required template-version provenance decision

Before the projection contract is frozen, the specification MUST decide how a
metadata instance records the exact `metadata.versionId` of the template used
to create it. The decision must state whether the Semantic V1 projector emits
that relationship on the root instance node or whether a separate metadata-
instance/export envelope records it outside the field-derived semantic graph.

Template-version provenance is not an ordinary form response and MUST NOT be
modeled as a field binding. Semantic V1 does not choose the relationship
predicate or its location in this scope draft.

## Deferred beyond V1

Semantic V1 does not include:

- concept-scheme constraints that do not affect projection;
- expected classes for externally referenced IRI values;
- remote ontology verification or controlled-vocabulary membership checks;
- ontology lookup, browsing, registry, or provider integrations;
- multiple predicates for one field;
- conditional or branch-specific semantic mappings;
- calculated, concatenated, parsed, or otherwise transformed values;
- RDF lists or RDF ordering semantics;
- reverse conversion from JSON-LD into a STAPLE response;
- user-authored or remotely fetched JSON-LD contexts;
- stable identifiers for nested nodes derived from particular response fields;
- dynamic language selection from another response field;
- OWL reasoning, SHACL validation, ontology alignment, or inferred equivalence;
- reverse properties, named graphs, reification, RDF-star, or arbitrary RDF
  graph authoring;
- automatic migration of legacy `ontologyId` annotations; or
- JSON-LD describing the template package itself.

Legacy `ontologyId` values MAY be preserved and presented as migration hints,
but they do not establish Semantic V1 conformance and MUST NOT be converted
without an exact, user-reviewed interpretation.

## Validation and compatibility independence

Semantic V1 validation depends on successful Core V1 package, form-component,
and cross-component validation. It does not depend on RJSF rendering, Form
Studio authoring, or STAPLE deployment compatibility.

```text
Core V1 conformance
|-- Semantic V1 validation
`-- application compatibility assessment

Core V1 + Semantic V1 + valid metadata instance
`-- JSON-LD projection
```

An application-compatibility failure MUST NOT prevent Semantic V1 validation
or invalidate Semantic V1 conformance. Conversely, Semantic V1 conformance does
not claim that a particular application can author, preserve, preview, or
deploy the semantic component. These are separate, versioned capability
assessments.

## Validation diagnostic contract

A validation diagnostic contains `stage`, `code`, `pointer`, and a human-facing
`message`. Consumers MUST use `code`, not `message`, for program logic. The
`pointer` is an RFC 6901 pointer into the outer template package.

The `semantic-schema` stage reports `SEMANTIC_COMPONENT_INVALID` for violations
of the component JSON Schema. The `semantic-profile` stage uses these stable
codes for cross-component rules:

| Code family | Codes |
| --- | --- |
| Validation prerequisite | `SEMANTIC_FORM_SCHEMA_REQUIRED` |
| IRI | `SEMANTIC_IRI_INVALID` |
| Field resolution | `SEMANTIC_FIELD_POINTER_INVALID`, `SEMANTIC_FIELD_POINTER_UNRESOLVED`, `SEMANTIC_FIELD_POINTER_REF_CYCLE`, `SEMANTIC_FIELD_POINTER_DUPLICATE`, `SEMANTIC_FIELD_TYPE_UNRESOLVED` |
| Binding compatibility | `SEMANTIC_BINDING_TYPE_INCOMPATIBLE`, `SEMANTIC_DATATYPE_INCOMPATIBLE`, `SEMANTIC_LANGUAGE_INVALID`, `SEMANTIC_LANGUAGE_INCOMPATIBLE` |
| Exact mappings | `SEMANTIC_MAPPING_VALUE_DUPLICATE`, `SEMANTIC_MAPPING_VALUE_TYPE`, `SEMANTIC_MAPPING_VALUE_NOT_ALLOWED`, `SEMANTIC_MAPPING_ENUM_UNCOVERED` |
| Node ownership | `SEMANTIC_PARENT_POINTER_INVALID`, `SEMANTIC_PARENT_REQUIRED`, `SEMANTIC_PARENT_NOT_FOUND`, `SEMANTIC_PARENT_AMBIGUOUS`, `SEMANTIC_PARENT_NOT_NODE`, `SEMANTIC_PARENT_OUTSIDE_NODE`, `SEMANTIC_PARENT_NOT_NEAREST`, `SEMANTIC_PARENT_SELF`, `SEMANTIC_PARENT_CYCLE` |

Projection diagnostics will use a separate stage and are not defined yet.

## Normative validation and next milestone

The examples-first milestone established the binding vocabulary encoded by the
normative [Semantic V1 component schema](../../../schemas/semantic/v1/semantics.schema.json).
The first five non-normative scenarios are maintained in
[`examples/semantic/v1/`](../../../examples/semantic/v1/). They cover the title,
default date datatype, direct ORCID IRI, exact local value-to-IRI mapping, and
repeated contributors through a local `$ref`.

The reference
[Semantic V1 validator](../../../scripts/semantic-v1-conformance.mjs) implements
component-shape validation, absolute-IRI and field-pointer checks, deterministic
local `$ref` traversal, effective field-type compatibility, exact mapping rules,
and node ownership with stable diagnostics. Its behavior is exercised by the
cross-component conformance tests.

The next contract milestone is the reference projection algorithm. Before that
contract is frozen, examples must cover number, boolean, `false`, `0`, empty-
string, missing, and `null` behavior; scalar arrays; inline nested objects;
invalid or unmapped response IRI values; and the template-version provenance
decision above. Each projection example must include expected expanded JSON-LD
and explicit edge-case behavior.
