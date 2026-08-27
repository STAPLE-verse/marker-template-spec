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

Ajv is a runtime dependency for structural validation. The independent
`jsonld` processor remains a repository test dependency and is not shipped in
this package.
