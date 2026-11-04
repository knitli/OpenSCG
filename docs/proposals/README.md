# OpenSCG proposals

A proposal is how the format changes. Anything that changes what is valid, what a field means, how canonical bytes are produced, or how signatures are verified needs one.

## Process

1. Copy [`0000-template.md`](0000-template.md) to `NNNN-short-title.md` using the next free number.
2. Open a pull request with only the proposal. Label it `proposal`.
3. Comment period: at least **14 days**, or **30 days** for a breaking change.
4. Maintainers record a decision — **accepted**, **rejected**, or **deferred** — with reasons, in the proposal's header.
5. An accepted proposal is implemented in a separate pull request that links back to it. That pull request must include the test vectors the proposal lists.

## States

| State       | Meaning                                       |
| ----------- | --------------------------------------------- |
| Draft       | Open for comment                              |
| Accepted    | Will be implemented; target version recorded  |
| Implemented | Released in the listed version                |
| Rejected    | Not going ahead; reasons recorded             |
| Deferred    | Not now; reasons and revisit trigger recorded |
| Withdrawn   | Author withdrew it                            |

## Index

| #                                                  | Title                                                           | State                     |
| -------------------------------------------------- | --------------------------------------------------------------- | ------------------------- |
| [0001](0001-unsupported-schema-version-finding.md) | A finding code for an unsupported schema_version (non-breaking) | Implemented (0.1.0-draft) |
| [0002](0002-structured-level-conditions.md)        | Structured conditions for level ranges (breaking)               | Draft                     |
