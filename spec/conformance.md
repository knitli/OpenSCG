# OpenSCG conformance procedure

**Suite version:** 0.1.0, for specification 0.1.0-draft
**Status:** Draft. Synthetic data only.

This document says how to test an implementation against OpenSCG. You need only this repository's `schema/`, `spec/` and `conformance/` directories. You do not need the reference library.

## 1. What you can claim

Run the parts that apply to what you built (spec §1.4). If every applicable case passes, you may say:

> _"[Name] passes the OpenSCG 0.1.0 conformance suite (suite 0.1.0) for: [parsing, canonicalization, structural validation, semantic validation, attestation verification]."_

Do not say "OpenSCG certified" or "OpenSCG compliant." There is no certification, and passing the suite is not a legal or policy determination (spec §1.2).

## 2. Parsing and canonicalization

Use `conformance/vectors/canonical/manifest.json`. Read every file as raw bytes.

1. For each `valid` case: strictly parse `input` (spec §8.2), canonicalize it (§8.3), and compare the result **byte for byte** with `expected`.
2. For each `invalid` case: strict parsing must fail. If your implementation reports codes, the code must equal `error`.

Two cases come from RFC 8785. Implementers are also encouraged to run the number-formatting table in RFC 8785 Appendix B.

## 3. Payload and statement bytes

Use `conformance/vectors/payload/manifest.json`.

1. Strictly parse `guide`.
2. Remove the top-level members listed in `excluded_members`. Canonicalize. Compare with `payload`, byte for byte.
3. SHA-256 of those bytes must equal `payload_digest.value`.
4. Where `statement` is present, build the approval statement from the guide (§9.1), using `authority.claimed_signer` as the signer, and produce the signed bytes (§9.2). Compare with `statement`, byte for byte.

## 4. Validation

Use `conformance/manifest.json`. For each case, read `file` as bytes, then:

1. If `expected.parse_error` is present, strict parsing must fail with that code. Stop.
2. Otherwise parse, and run structural validation (§6). The result (`valid` or `invalid`) must equal `expected.structure`. If it is `invalid`, the case also expects `approval_ready: false`. Stop.
3. Run semantic validation (§7) with **no extensions supported**.
4. Whether any finding blocks approval (§7.2) must equal `expected.approval_ready`.
5. If `expected.findings` is present, the set of `(code, pointer)` pairs you report must equal it **exactly** — no missing findings and no extra ones. Order does not matter. Messages are not compared.

## 5. Attestation verification

Use `conformance/vectors/attestation/manifest.json`. For each case:

1. Strictly parse `guide`. The attestation is `attestations[0]`.
2. Build a trust policy from `trust_anchors` and `crls` (PEM files in the same directory). Use the manifest's `verify_at` as the verification time. Use `unknown_revocation` if present, otherwise `fail`. Use the default algorithm and key-usage rules (§9.4).
3. Verify. Every member of `expected` must match your result exactly. Members not listed are not compared.

## 6. Reporting results

Publish, with your claim:

- the suite version and the commit or release you tested against;
- the number of cases run and passed in each section;
- any case you did not run, and why.

If you believe a case is wrong, open an issue. Do not change the case locally and then claim a pass.

## 7. Versioning of this suite

The suite has its own version (`suite_version` in `conformance/manifest.json`).

- **Patch** (0.1.x): fixes to wrong cases, or cases that only test existing rules more thoroughly.
- **Minor** (0.x.0): new cases for new, non-breaking specification features.
- A new specification version gets a new suite version.

A fix to a case is never silent: it is listed in `CHANGELOG.md`.

## 8. Implementations known to pass

| Implementation                        | Language   | Sections | Suite | Notes                                                                                           |
| ------------------------------------- | ---------- | -------- | ----- | ----------------------------------------------------------------------------------------------- |
| `@knitli/openscg` (reference library) | TypeScript | 2–5      | 0.1.0 | Same project as the specification.                                                              |
| `consumers/python`                    | Python     | 2–5      | 0.1.0 | Same project. Written from published materials only; shares no code with the reference library. |

We will add independent implementations here when their authors tell us about them and agree to be listed.
