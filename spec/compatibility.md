# OpenSCG compatibility, extensions, and migration

**Applies to:** specification 0.1.0 and later
**Status:** Draft

This document says how OpenSCG changes over time without losing anyone's data, and what an implementation must do with a file from a different version.

## 1. Version numbers

The specification uses [Semantic Versioning 2.0.0](https://semver.org/) numbers: `MAJOR.MINOR.PATCH`, with an optional pre-release label such as `-draft`.

| Part  | Changes when                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------- |
| PATCH | Wording is clarified, or a mistake is fixed, without changing what is valid or what anything means. |
| MINOR | Something is added that existing valid files are not affected by.                                   |
| MAJOR | Anything breaking (section 2).                                                                      |

**Before 1.0.** While the major version is 0, a MINOR release MAY be breaking. Every breaking change still needs a proposal, release notes, and a migration (section 5). The `-draft` label means the version is open for comment and may change before it is final.

The `schema_version` in a file is the full specification version, including any pre-release label. The schema directory is named by `MAJOR.MINOR` (for example `schema/0.1/`).

## 2. What counts as breaking

A change is **breaking** if either:

- a file that was valid becomes invalid, or a finding's severity becomes more severe; or
- a field, value, or rule changes meaning, so that a consumer reading an old file under the new rules would understand something different.

A change to how canonical bytes, the payload, or approval statements are formed is **always breaking**, because it changes what existing signatures cover. Such a change MUST use a new identifier (`openscg-payload-v2`, `OpenSCG-Approval-Statement-v2`, and so on), and verifiers MUST keep supporting the old identifiers for files that use them.

## 3. Examples

These examples are the reference for classifying a change. Each one is concrete.

### Accepted as non-breaking

| Change                                                                                                                                                                                                                                    | Why it is not breaking                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Add an optional field `entry.review_cycle_months`.                                                                                                                                                                                        | Old files do not have it and stay valid.                                                                                                                                 |
| Add a new finding code at `warning` severity.                                                                                                                                                                                             | Nothing that was approval-ready stops being so.                                                                                                                          |
| Add a new finding code at a blocking severity for a case that was previously **undefined** — for example `OSCG-V035` for an unsupported `schema_version` (proposal [0001](../docs/proposals/0001-unsupported-schema-version-finding.md)). | Files of the supported version are unaffected. The behavior was already required by spec §3.1; the code makes it testable.                                               |
| Add a new value to the `controls[].kind` list.                                                                                                                                                                                            | Old values keep their meaning. Old consumers see the new value as a structural error, which is a _safe_ failure, but this is still released as MINOR with release notes. |
| Add a new profile.                                                                                                                                                                                                                        | Files naming existing profiles are unaffected. Old consumers report it as unsupported (`OSCG-V031`).                                                                     |
| Clarify wording in the specification.                                                                                                                                                                                                     | PATCH, as long as no rule changes.                                                                                                                                       |

### Rejected as breaking (or requiring a MAJOR and a migration)

| Change                                                                           | Why it is breaking                                                                                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Rename `entry.description` to `entry.element`.                                   | Every existing file becomes invalid.                                                                                    |
| Make `subject` required by the schema.                                           | Files valid before become invalid. (Today, a missing subject is a semantic `error`, which still allows saving a draft.) |
| Change `relative_to_record_creation.years` to mean "years from guide issuance."  | Same data, different meaning: the most dangerous kind of break.                                                         |
| Add `history` to the payload exclusion list.                                     | Changes payload bytes, and so invalidates every existing signature. Needs `openscg-payload-v2`.                         |
| Allow `level_range` without `condition_text`.                                    | Loosens a rule the project adopted on purpose. Rejected outright, not just MAJOR.                                       |
| Turn `OSCG-V019` (unclassified entry with a reason) from `warning` into `error`. | Files that were approval-ready stop being so.                                                                           |

## 4. Extensions

Extensions (spec §4.8) let anyone add data without changing the specification.

**Namespaces.**

- A namespace is a reverse-DNS name, for example `org.example.widgets`.
- Use a domain you control. You do not need to register it with OpenSCG.
- Namespaces beginning `org.openscg.` are reserved for this project. `org.openscg.migration` is defined in section 5.
- Once published, a namespace's meaning MUST NOT change incompatibly. Use a new namespace or the extension's own `version` instead.

**`must_understand`.**

- `true`: an implementation that does not support the namespace MUST NOT approve, sign, or present the guide as fully interpreted (`OSCG-V033`). Use this when ignoring the data could change what the guidance means.
- `false`: an implementation MAY ignore the data for interpretation, but MUST preserve it (`OSCG-V034`).
- When unsure, use `true`.

**Promotion.** If an extension becomes widely used, a proposal may promote it into the core. The proposal says how the old extension maps to the new field, and the migration (section 5) moves the data.

## 5. Migration

A **migration** reads a document in one version and writes a document in another.

Every migration:

1. **Produces a new draft.** It MUST NOT rewrite a signed revision in place. The migrated document is a new revision, and it needs its own review and approval. The original file and its attestations MUST be kept unchanged.
2. **Never invents guidance or markings.** If the target version requires something the source does not have — for example `document_markings` — the migration leaves it absent and says so. The result may fail validation until a person supplies it.
3. **Reports what it did not preserve** with a loss report (spec §7.5). A mapping that changes a value (for example a renamed profile) appears as `changed`. A member that was moved appears as `removed` from its original location.
4. **Parks unmapped data rather than dropping it.** Members the target version does not define are moved, unchanged, into the `org.openscg.migration` extension under `data.unmapped`, keyed by their original JSON Pointer, with `must_understand: true`. That blocks approval until a person decides what to do with them.
5. **Explains itself** in plain-language notes.

**Worked example.** The project requirements contain an illustrative excerpt that predates the schema (profile `cnsidraft`, entries without `kind`). It is in [`conformance/migration/requirements-illustration.json`](../conformance/migration/requirements-illustration.json). The reference library's `fromRequirementsIllustration` migration:

- maps `profile` from `cnsidraft` to `cnsi-core` and reports `/profile` as `changed`;
- gives `item-a` and `item-b` the kind `element`, and gives `combined` the kind `compilation` (it has `condition_text` and two references);
- adds `lifecycle: {"state": "draft"}` and `synthetic: true` (the title says SYNTHETIC);
- does **not** add `document_markings`, and its notes say an authorized person must supply them.

If the source had an extra member such as `"color": "blue"`, the result would carry `extensions["org.openscg.migration"].data.unmapped["/color"] = "blue"`, the loss report would list `/color` as `removed`, and validation would report `OSCG-V033` until it is resolved.

## 6. Reading other versions

- A consumer that reads a file whose `schema_version` it does not support MUST report `OSCG-V035` (`unsupported`) and MUST NOT interpret the content (spec §3.1). It MAY offer a migration if it has one.
- A consumer MUST NOT silently "upgrade" a file and then present it as the original.
- Verifiers MUST keep verifying attestations made under older payload and statement identifiers for as long as they claim to support those versions.

## 7. Deprecation

To retire a field, value, or rule:

1. A proposal marks it **deprecated** and says what replaces it.
2. The next MINOR release keeps accepting it, and validators SHOULD report a `warning` when they see it.
3. It may be removed no sooner than the next MAJOR release (or, before 1.0, no sooner than two MINOR releases later), with a migration.

Previous releases of the schema, specification and conformance suite stay available at their tags forever.
