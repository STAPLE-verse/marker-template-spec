# MARKER Template TypeScript Runtime

This directory contains the optional JavaScript/TypeScript implementation of
the language-independent MARKER Metadata Template Specification.

The normative specification, schemas, algorithms, diagnostics, and fixtures
remain at the repository root. This package provides reusable structural and
cross-component validation and Semantic V1 projection. It contains no Prisma,
RJSF, application authorization, or persistence logic.

The package is private until the first V1 release candidate is prepared. Its
first published build should use the matching exact prerelease version, such as
`1.0.0-rc.1`, under an npm prerelease tag rather than `latest`. Consumers must
pin that exact version instead of depending on a sibling checkout or mutable
branch. Its version describes the implementation release; the package
documentation declares the exact Core and Semantic profile release it supports.

## Public API

```ts
import {
  projectSemanticV1,
  validateCoreV1,
  validateSemanticV1,
} from "@staple-verse/marker-template-runtime"

const coreDiagnostics = validateCoreV1(templatePackage)
const semanticDiagnostics = validateSemanticV1(templatePackage)
const projection = projectSemanticV1(templatePackage, validatedResponse)
```

The validators accept unknown JSON input and return stable structured
diagnostics. Projection returns either one expanded JSON-LD root graph or an
atomic failure with diagnostics. The package also exports its supported profile
identifiers, generated schema objects, and TypeScript data/result types.

### Semantic V1 authoring analysis

Applications that let a user build Semantic V1 bindings interactively (rather
than just validate a finished document) need field-level information before a
document is fully valid. Two non-normative, component-oriented queries expose
the same primitives `validateSemanticV1` uses internally, so an authoring tool
never has to reimplement field-pointer resolution or node-ownership rules
against its own copy of the Core schema:

```ts
import {
  analyzeSemanticV1Bindings,
  findAncestorNodeBindings,
  type SemanticBindingAnalysis,
} from "@staple-verse/marker-template-runtime"

const analysis: SemanticBindingAnalysis[] = analyzeSemanticV1Bindings({
  form: { schema },
  semantics,
})
// Per binding (in array order): resolution status, the resolved Core
// schema(s), and the effective value schema(s) used for type/datatype
// compatibility checks.

const ancestors = findAncestorNodeBindings(semantics.bindings, fieldPointer)
// `node` bindings that structurally contain `fieldPointer`, nearest first.
// `ancestors[0]?.nearest === true` identifies the only binding index that a
// conformant `parentNodePointer` may reference for that field.
```

`analyzeSemanticV1Bindings` takes the same `{ form, semantics }` shape as
`validateSemanticV1` and returns one entry per binding, in binding order, even
when a pointer is invalid, cyclic, or unresolved. `findAncestorNodeBindings`
takes just the binding array and a candidate field pointer — it does not need
the Core schema, because pointer containment is a property of the pointers
themselves. Neither function performs structural or IRI validation; call
`validateSemanticV1` for a save/export-blocking, all-diagnostics check.

Ajv is a runtime dependency for structural validation. The independent
`jsonld` processor remains a repository test dependency and is not shipped in
this package.
