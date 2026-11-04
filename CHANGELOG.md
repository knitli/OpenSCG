# Changelog

All notable changes to OpenSCG are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Specification versions follow the rules in `spec/compatibility.md` once it is published.

## Unreleased

### Added

- Project bootstrap: implementation plan, governance, contribution and security policies, proposal process, CI, and a release workflow that is ready but switched off.
- JSON Schema 2020-12 for guides (`schema/0.1/guide.schema.json`), with stable `$id`.
- Specification sections 1–6: scope and limits, terms, identifiers, data model, profiles, structural validation.
- Synthetic examples: the LANTERN guide and the requirements' compilation example.
- Reference library: `validateStructure()`, findings model, embedded schema.
- Specification section 7: semantic rules with stable finding codes, four severities, and loss reports.
- Reference library: `validate()`, `validateSemantics()`, `RULES`, `compareForLoss()`.
