# V1 conformance fixtures

Fixtures are organized by validation stage and expected result:

```text
capabilities/          Versioned application capability probes
valid/                 Core V1 conforming packages
invalid/package/       Outer-package failures
invalid/components/    Invalid dialect or JSON Schema failures
invalid/profile/       Unsupported Core form-profile constructs
invalid/cross/         Form schema / UI schema integrity failures
```

Every invalid package has a sibling `.expected.json` file declaring the stage,
stable diagnostic code, and RFC 6901 package pointer of its first expected
diagnostic. The conformance tests execute the stages in the order defined by
the normative specification.

Capability fixtures retain focused application-version evidence. They are not
outer packages and are not independently claims of Core conformance.
