# Non-schema conformance tests

This directory contains executable checks for normative profile requirements
that cannot be represented reliably by the MARKER JSON Schemas.

Expected examples include:

- `uiSchema` references point to fields defined by `form.schema`;
- semantic bindings target existing template fields;
- the form schema uses only the supported RJSF profile; and
- a template survives the defined Form Studio round trip.

Each test must cite the specification requirement it implements. A test is an
implementation of that written requirement; adding a test alone does not create
a normative rule.
