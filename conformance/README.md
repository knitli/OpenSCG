# Conformance suite

Everything here is **synthetic**. The procedure for using it is in [`spec/conformance.md`](../spec/conformance.md).

| Path                   | Contents                                            |
| ---------------------- | --------------------------------------------------- |
| `manifest.json`        | Validation cases and their expected results         |
| `cases/`               | One guide file per validation case                  |
| `vectors/canonical/`   | Strict-parsing and RFC 8785 vectors                 |
| `vectors/payload/`     | Payload bytes, digests and approval-statement bytes |
| `vectors/attestation/` | Detached CMS attestation cases                      |

The validation cases are produced by `scripts/generate-conformance-cases.ts`. The expected results in that script are written by hand from the specification, not computed by the reference library, so the suite does not check the library against itself.
