# Test vectors

Every vector is **synthetic**. Each directory has a `manifest.json` describing its cases and expected results.

| Directory | What it tests | Spec |
|---|---|---|
| `canonical/` | Strict parsing (valid and invalid inputs) and RFC 8785 canonical bytes. Two cases come straight from RFC 8785. | §8.2, §8.3 |
| `payload/` | Payload bytes, payload digest, and the exact approval-statement bytes for each example guide. | §8.4, §8.5, §9.1, §9.2 |
| `attestation/` | Detached CMS attestations: one valid case and failure cases for each verification result. | §9.3, §9.4 |

**Read files as raw bytes.** Several canonical vectors are deliberately invalid JSON or invalid UTF-8, and `.jcs` / `.bin` files have no trailing newline.

**About the test PKI.** The certificates in `attestation/` come from a throwaway certificate authority created in memory by `scripts/generate-attestation-vectors.ts`. Its private keys were never written to disk. The certificates are labeled `SYNTHETIC … (TEST ONLY)`. Never add them to a real trust store.

Evaluate every attestation case at the manifest's `verify_at` time. The CRL in `attestation/` is current from 2026-10-01 to 2035-12-31.
