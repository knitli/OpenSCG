# 0001: A finding code for an unsupported schema_version

- **State:** Implemented (0.1.0-draft)
- **Author(s):** OpenSCG maintainers
- **Opened:** 2026-11-04
- **Target version:** 0.1.0-draft
- **Kind:** Non-breaking
- **Decision and reasons:** Accepted under the pre-release rule in GOVERNANCE.md ("Before the first tagged release"). It makes an existing requirement testable without changing any valid file. It will be reopened for comment with the first tagged release.

## Summary

Add finding `OSCG-V035` (`unsupported`) for a document whose `schema_version` the implementation does not support. Validators report it and stop, instead of trying to interpret the document.

## Problem

Spec §3.1 already said a consumer "MUST report it as unsupported." But there was no code for it, so the conformance suite could not test it, and the reference library actually reported it as an ordinary structural error (`OSCG-S000`) alongside any other schema failures. Those other failures are meaningless for a different version.

**Example.** A future file with `"schema_version": "0.2.0"` and a new level value `"CUI"`:

- Before: two `OSCG-S000` errors, one for the version and one for the level. That suggests the level is wrong, when really the file is from a version this tool cannot read.
- After: exactly one finding, `OSCG-V035 unsupported /schema_version`.

## Proposal

- Spec §3.1 and the §7.3 table gain `OSCG-V035`, severity `unsupported`.
- Validators check `schema_version` first. If it is a string they do not support, they return only `OSCG-V035`.

## Compatibility

Non-breaking (spec/compatibility.md §3). No file of the supported version is affected. The behavior was already required; this gives it a code.

## Migration

None needed.

## Security review

Reduces risk: it stops a consumer from partially interpreting data whose meaning may have changed. It does not affect canonical bytes, digests, or signatures.

## Test vectors

- `conformance/cases/unsupported-schema-version.json`: expect `[OSCG-V035 /schema_version]`, `approval_ready: false`.
- Passes in both the reference library and `consumers/python`.

## Alternatives considered

- Keep reporting `OSCG-S000`. Rejected: it mixes "unsupported" with "missing data," which spec §7.2 forbids.
