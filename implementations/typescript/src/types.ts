export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]

export interface JsonObject {
  [key: string]: JsonValue
}

export interface ConformanceDiagnostic {
  stage: string
  code: string
  pointer: string
  message: string
}

export interface SemanticValueMapping {
  value: Exclude<JsonPrimitive, null>
  iri: string
}

interface SemanticBindingBase {
  fieldPointer: string
  predicate: string
  parentNodePointer?: string
}

export interface SemanticLiteralBinding extends SemanticBindingBase {
  valueKind: "literal"
  datatypeIri?: string
  language?: string
}

export interface SemanticIriBinding extends SemanticBindingBase {
  valueKind: "iri"
  valueMappings?: SemanticValueMapping[]
}

export interface SemanticNodeBinding extends SemanticBindingBase {
  valueKind: "node"
  classIri?: string
}

export type SemanticBinding =
  | SemanticLiteralBinding
  | SemanticIriBinding
  | SemanticNodeBinding

export interface SemanticV1Component {
  root?: {
    classIri: string
  }
  bindings: SemanticBinding[]
}

export interface TemplateAgentIdentifier {
  value: string
  scheme: string
}

export interface TemplateAffiliation {
  name: string
  identifier?: string
  identifierScheme?: string
}

export interface TemplateContributor {
  name: string
  nameType?: "Personal" | "Organizational"
  givenName?: string
  familyName?: string
  roles?: string[]
  identifiers?: TemplateAgentIdentifier[]
  affiliations?: TemplateAffiliation[]
}

export interface TemplatePublisher {
  name: string
  identifier?: string
  identifierScheme?: string
}

export interface TemplateLicense {
  identifier?: string
  uri?: string
}

interface TemplateMetadataBase {
  familyId: string
  versionId: string
  version: string
  resourceType: "MetadataTemplate"
  title: string
  description?: string
  language?: string
  contributors?: TemplateContributor[]
  publisher?: TemplatePublisher
  license?: TemplateLicense
  keywords?: string[]
  domain?: string
  createdAt: string
  updatedAt: string
  releaseNotes?: string
}

export interface DraftTemplateMetadata extends TemplateMetadataBase {
  status: "draft"
  publishedAt?: never
}

export interface PublishedTemplateMetadata extends TemplateMetadataBase {
  status: "published"
  description: string
  language: string
  contributors: Array<TemplateContributor & { roles: string[] }>
  publisher: TemplatePublisher
  license: TemplateLicense
  publishedAt: string
}

export type TemplateMetadata = DraftTemplateMetadata | PublishedTemplateMetadata

export interface MarkerTemplatePackage {
  conformsTo: string[]
  metadata: TemplateMetadata
  form: {
    schema: JsonObject
    uiSchema: JsonObject
  }
  semantics?: SemanticV1Component
}

export interface SemanticProjectionOptions {
  rootInstanceIri?: string
}

export interface ExpandedJsonLdLiteral {
  "@value": string | number | boolean
  "@type"?: string
  "@language"?: string
}

export interface ExpandedJsonLdReference {
  "@id": string
}

export type ExpandedJsonLdValue =
  | ExpandedJsonLdLiteral
  | ExpandedJsonLdReference
  | ExpandedJsonLdNode

export interface ExpandedJsonLdNode {
  "@id"?: string
  "@type"?: string[]
  [predicate: string]: string | string[] | ExpandedJsonLdValue[] | undefined
}

export interface SemanticProjectionResult {
  expandedJsonLd: ExpandedJsonLdNode[] | null
  diagnostics: ConformanceDiagnostic[]
}
