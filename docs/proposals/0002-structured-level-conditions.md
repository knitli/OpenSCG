# 0002: Structured conditions for level ranges

- **State:** Draft — open for comment (30-day period for a breaking change)
- **Author(s):** OpenSCG maintainers
- **Opened:** 2026-11-04
- **Target version:** 0.2.0 at the earliest
- **Kind:** Breaking
- **Decision and reasons:** Pending. This proposal is published partly as a worked example of the breaking-change process. It will not be accepted without practitioner feedback.

## Summary

Replace the single `level_range.condition_text` with a list of conditions, each naming the level it leads to.

## Problem

Today a range is one block of text:

```json
"level_range": {
  "lowest": "U",
  "highest": "C",
  "condition_text": "Unclassified when stated only as a general band name. Confidential when stated to within 10 MHz."
}
```

A reader has to parse the sentence to see which condition leads to which level. Renditions cannot show the conditions as a table, and a validator cannot check that every level in the range is reachable.

## Proposal

```json
"level_range": {
  "lowest": "U",
  "highest": "C",
  "conditions": [
    { "level": "U", "condition_text": "Stated only as a general band name." },
    { "level": "C", "condition_text": "Stated to within 10 MHz." }
  ]
}
```

- `conditions` is required, with at least one item. Each item's `level` must lie within the range.
- New finding (warning): a level at either end of the range has no condition.
- Conditions remain human-readable text. This does **not** introduce executable rules.

## Compatibility

**Breaking** (spec/compatibility.md §2): every file that uses `level_range` today becomes invalid, because `condition_text` is removed and `conditions` is required. It also changes payload bytes for those entries, so their existing signatures do not cover the new form. That is expected — the migrated guide is a new revision.

## Migration

- Move `condition_text` into a single condition with `level` set to `highest`, and add a note: "Migrated from free text; split into per-level conditions."
- The loss report lists `/entries/N/level_range/condition_text` as `removed` (it now lives under `conditions/0`).
- The migrated guide is a new draft and needs new approval. The original, signed revision is kept.

The automatic mapping cannot split one sentence into several conditions correctly. It preserves the text and leaves the splitting to a person.

## Security review

No change to canonicalization, digests, or signature formats. The main risk is a migration that splits text wrongly and changes the meaning; the proposal avoids that by not splitting automatically.

## Test vectors

To be added if accepted:

- valid: a range with one condition per level;
- invalid: a condition whose level is outside the range;
- warning: an end of the range with no condition;
- migration: LANTERN's `perf-band`, with the expected loss report.

## Alternatives considered

- Keep the free text and add an optional `conditions` alongside it. Non-breaking, but leaves two ways to say the same thing, which invites disagreement between them.

## Open questions

- Do practitioners write range guidance this way, or is a single sentence more natural for them?
