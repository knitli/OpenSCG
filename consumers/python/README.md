# OpenSCG independent consumer (Python)

A second, separate implementation of OpenSCG 0.1. It exists to test one claim: that the **published materials alone** are enough to build a working consumer.

It was written from:

- `spec/openscg.md`
- `schema/0.1/guide.schema.json`
- the fixtures in `conformance/`

It does not use, import or call the TypeScript reference library. It shares no parsing, canonicalization, validation or CMS code with it:

| Task                          | This consumer uses       | The reference library uses |
| ----------------------------- | ------------------------ | -------------------------- |
| Strict parsing                | Python `json` with hooks | Its own parser             |
| Canonical form (RFC 8785)     | Its own serializer       | Its own serializer         |
| JSON Schema                   | `jsonschema`             | Ajv                        |
| Semantic rules                | Written from spec §7     | Written from spec §7       |
| CMS signature and path checks | OpenSSL command line     | PKI.js                     |
| ASN.1 reading                 | `asn1crypto`             | asn1js                     |

**Honest limit.** The same project wrote both implementations. Passing here shows the materials are _sufficient_. It does not show adoption by an independent party. That needs an outside implementer.

## Run

You need [uv](https://docs.astral.sh/uv/) and OpenSSL 3.

```bash
uv run --project consumers/python pytest
```
