# Changelog

All notable changes to OpenSCG are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Specification versions follow the rules in `spec/compatibility.md`.

## Unreleased

## 0.1.0 — 2026-11-04

First tagged release. OpenSCG is a proposed open format, not an official government standard.

`schema_version` is now `"0.1.0"`. Files written against the pre-release `"0.1.0-draft"` value are reported as unsupported (`OSCG-V035`) and are not interpreted; rewrite `schema_version` to `"0.1.0"` to use them with this release.

### Added

- Project bootstrap: implementation plan, governance, contribution and security policies, proposal process, CI, and a release workflow that is ready but switched off.
- JSON Schema 2020-12 for guides (`schema/0.1/guide.schema.json`), with stable `$id`.
- Specification sections 1–6: scope and limits, terms, identifiers, data model, profiles, structural validation.
- Synthetic examples: the LANTERN guide and the requirements' compilation example.
- Reference library: `validateStructure()`, findings model, embedded schema.
- Specification section 7: semantic rules with stable finding codes, four severities, and loss reports.
- Reference library: `validate()`, `validateSemantics()`, `RULES`, `compareForLoss()`.
- Specification sections 8–10: strict parsing rules, RFC 8785 canonical bytes, the signed payload and its exclusions, approval statements with domain separation, the `openscg-cms-detached-v1` attestation profile, verification results reported separately, renditions, and signed release manifests.
- Reference library: `parseStrict()`, `canonicalize()`, `payloadDigest()`, `buildApprovalStatement()`, `createAttestation()`, `verifyAttestation()`, `signDetached()`, `verifyDetached()`, and release-manifest functions.
- Conformance vectors: canonicalization (including RFC 8785 examples), payload and statement bytes, and twelve synthetic attestation cases.
- Conformance suite (`conformance/manifest.json`, 35 validation cases with hand-written expected results) and the versioned test procedure `spec/conformance.md` (suite 0.1.0).
- An independent Python consumer (`consumers/python`) that passes the whole suite using only published materials, OpenSSL and `asn1crypto`. Run in CI.
- `spec/compatibility.md`: versioning, what counts as breaking with accepted and rejected examples, extension namespaces (`org.openscg.` reserved), migration rules, reading other versions, deprecation.
- Finding `OSCG-V035` for an unsupported `schema_version` (proposal 0001), in both implementations and the suite.
- Migration interface with loss reporting, and a worked migration from the requirements' illustrative excerpt.
- Proposals 0001 (non-breaking, implemented) and 0002 (breaking, draft); a pre-release acceptance rule in GOVERNANCE.md.
- Release guide, open-questions tracker, and requirements traceability matrix.
