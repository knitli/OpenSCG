# OpenSCG specification

**Version:** 0.1.0-draft
**Status:** Draft for public comment. Not an official government standard. Not legal advice.
**Schema:** [`schema/0.1/guide.schema.json`](../schema/0.1/guide.schema.json), `$id` `https://openscg.knitli.com/schema/0.1/guide.schema.json`

## 1. Introduction

### 1.1 What this document is

OpenSCG is a file format for security classification guides (SCGs). An SCG tells people how to classify information about a program, system, or subject: which pieces of information are classified, at what level, why, and for how long.

This document says what each part of an OpenSCG file means, and lists rules that a JSON Schema cannot express on its own. The JSON Schema says what a file _looks_ like. This document says what it _means_.

### 1.2 What a valid file proves, and what it does not

A file that passes every check in this specification is **well-formed and internally consistent**. For example: every reference points at an entry that exists, and every classified entry has a reason and a declassification instruction.

A valid file does **not** prove that:

- the guidance is correct, lawful, or approved;
- the person named as original classification authority (OCA) holds that authority;
- the guide has been issued or distributed;
- the guide complies with E.O. 13526, 32 CFR Part 2001, an agency manual, or any other rule.

Those are decisions for responsible people and organizations. Software that implements OpenSCG MUST NOT describe a file as "compliant" on the strength of validation alone.

### 1.3 Conformance language

The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are to be read as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in capitals.

### 1.4 Kinds of implementation

- A **producer** writes OpenSCG files.
- A **consumer** reads them.
- A **validator** reports findings about them (section 7).
- A **verifier** checks attestations (section 9).

One program can be several of these.

## 2. Terms

| Term                  | Meaning                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Guide**             | One OpenSCG file: a single revision of one SCG.                                                                    |
| **Entry**             | One item of guidance about a described piece of information.                                                       |
| **Element**           | An entry about a single piece of information (`kind: "element"`).                                                  |
| **Compilation**       | An entry about protection that applies when several pieces of information appear together (`kind: "compilation"`). |
| **Level**             | One of `U` (Unclassified), `C` (Confidential), `S` (Secret), `TS` (Top Secret). Ordered U < C < S < TS.            |
| **Classified entry**  | An entry whose `level` is C, S or TS, or whose `level_range.highest` is C, S or TS.                                |
| **Document markings** | The classification and markings of the SCG document itself — not of the information it describes.                  |
| **Profile**           | A named set of extra semantic rules (section 5).                                                                   |
| **Finding**           | One result from validation (section 7).                                                                            |
| **Payload**           | The part of a guide that a digest and signature cover (section 8).                                                 |

## 3. Identifiers and versions

### 3.1 Schema version

Every file MUST have `schema_version`. For this version it is exactly `"0.1.0-draft"`. A consumer MUST NOT guess how to read a file whose `schema_version` it does not know; it MUST report it as unsupported.

### 3.2 Schema identifier

The schema's `$id` is an **identifier**, not a promise that the URL resolves. Validators SHOULD use the copy of the schema bundled with their implementation, or a copy obtained from a tagged release, rather than fetching it over the network. (This also keeps validation working offline.)

### 3.3 Guide and revision identifiers

- `guide_id` identifies the guide across all of its revisions. It MUST be an absolute URI. A `urn:uuid:` URI ([RFC 9562](https://www.rfc-editor.org/rfc/rfc9562)) is RECOMMENDED. It MUST NOT change between revisions.
- `revision_id` identifies one revision. It MUST be unique within the guide. It is human-readable (for example `2026-r1` or `draft-3`). It carries no ordering; use `history` for order.
- `entry_id` and `section_id` MUST be unique within the guide (section 7). They SHOULD stay the same for the same guidance across revisions, so that people can follow an entry through changes.

### 3.4 Example: what changes between revisions

A guide `urn:uuid:5e1d…a001` at revision `2026-r1` is approved. The author then fixes a typo in one entry.

- The result is a **new revision** (for example `2026-r2`) with the **same** `guide_id`.
- The payload digest changes, so the approval of `2026-r1` does not carry over (section 9).
- `2026-r1`'s file and attestation stay exactly as they were and still verify.

## 4. Data model

This section explains each part of a guide. The schema is normative for structure; this section is normative for meaning.

### 4.1 Guide information

| Field                       | Meaning                                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile`                   | Which profile's rules apply (section 5).                                                                                                                                      |
| `synthetic`                 | `true` means the guide is invented. Consumers SHOULD show this prominently, including on every rendition. All public examples MUST set it.                                    |
| `title`, `subject`, `scope` | What the guide covers and does not cover. `subject` corresponds to 32 CFR 2001.15(b)(1).                                                                                      |
| `issuing_organization`      | Who issues the guide.                                                                                                                                                         |
| `point_of_contact`          | Who to ask about the guide (32 CFR 2001.15(b)(3)).                                                                                                                            |
| `oca`                       | The OCA who approves the guide: name and position, or a personal identifier (32 CFR 2001.15(b)(2)). `highest_level` is a **claim**.                                           |
| `dates`                     | `issued` and `last_reviewed` correspond to 32 CFR 2001.15(b)(4). `next_review_due` supports the five-year review in 32 CFR 2001.16; recording it does not perform the review. |
| `lifecycle`                 | The recorded state of this revision (4.2).                                                                                                                                    |
| `introduction`, `sections`  | Front matter and optional grouping for display.                                                                                                                               |

### 4.2 Lifecycle

| State        | Meaning                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `draft`      | Being written. May contain errors.                                                                      |
| `candidate`  | Frozen for review and approval. Its content is not expected to change; any change makes a new revision. |
| `issued`     | A person has recorded that the organization issued this revision.                                       |
| `superseded` | A person has recorded that a later guide replaced this one. `superseded_by` SHOULD say which.           |
| `cancelled`  | A person has recorded that the guide was cancelled.                                                     |

`issued`, `superseded` and `cancelled` record what a person says an organization did. Software MUST NOT set them merely because a signature exists or verifies. Issuance and distribution are organizational acts.

A consumer MUST NOT assume an old guide is still in force because its state says `issued`; a later record may supersede it.

### 4.3 Document markings

`document_markings` describes the **SCG document's own** protection: its overall classification, its banner line, controls, and its classification authority block.

- It is separate from the guidance in `entries`. An unclassified guide can describe Secret information (the LANTERN example does).
- Producers MUST NOT fill it in automatically from the highest entry level. Markings are decided by an authorized person. `document_markings.review` records whether that review has happened.
- Each entry and section MAY carry `portion_marking`: the marking of that row _within the guide document_. It is not the level of the information the row describes.

**Example.** In the LANTERN example, entry `perf-range` has `"level": "S"` and `"portion_marking": "(U)"`. This means: the _fact that range figures are Secret_ is unclassified, so the row may appear in an unclassified guide; an actual range figure is Secret.

### 4.4 Entries

Each entry describes one piece of information precisely and says how to protect it.

| Field                               | Meaning                                                                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entry_id`                          | Stable identifier (3.3).                                                                                                                                                                                    |
| `kind`                              | `element` or `compilation` (4.5).                                                                                                                                                                           |
| `description`                       | A precise description of the information. Vague descriptions ("program details") are the failure the ISOO FY2025 report describes; validators cannot judge precision, so this stays a human responsibility. |
| `level` **or** `level_range`        | Exactly one. A `level_range` MUST state `condition_text`: which conditions decide the level. A bare range with no conditions is not allowed.                                                                |
| `regime`                            | `cnsi` (default when absent) or `aea`. See 5.3.                                                                                                                                                             |
| `condition_text`, `exceptions_text` | Human-readable conditions. Not executable rules.                                                                                                                                                            |
| `references`                        | `entry_id`s of related entries.                                                                                                                                                                             |
| `controls`                          | Dissemination, CUI, or handling markings that apply to the described information.                                                                                                                           |
| `reason`                            | For classified CNSI entries: one or more E.O. 13526 §1.4 categories and a concise explanation.                                                                                                              |
| `declassification`                  | For classified entries: one instruction (4.6).                                                                                                                                                              |
| `sources`                           | Where the guidance comes from.                                                                                                                                                                              |
| `statements`                        | Optional value, damage, and unclassified statements. The ISOO handbook recommends these; they are not legal requirements.                                                                                   |
| `notes`, `extensions`               | Free text; extension data (4.8).                                                                                                                                                                            |

**Unclassified entries.** An entry at `U` does not need a `reason` or `declassification`. Producers MUST NOT invent a classified rationale for an unclassified entry.

### 4.5 Compilations

A compilation entry says that a combination of information needs protection that each piece alone does not.

- `condition_text` describes, in words, when the combination applies.
- `references` lists the constituent entries, where that is meaningful.
- `level` (or `level_range`), `reason` and `declassification` describe the protection for the **combination**.

A compilation entry does not change the constituents' own levels. In `requirements-compilation.json`, `item-a` and `item-b` stay `U`; only `combined` is `S`.

OpenSCG does not define a machine evaluator for compilation conditions. A consumer MUST NOT present a compilation as automatically detected or enforced unless it has its own, separately tested rule for that specific case.

### 4.6 Declassification instructions

Exactly one of:

| `kind`                        | Meaning                                                                                    | Example                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `date`                        | Declassify on this calendar date.                                                          | `{"kind":"date","date":"2040-12-31"}`                                 |
| `event`                       | Declassify when this event happens. The event SHOULD be independently checkable.           | `{"kind":"event","event_text":"Retirement of the last fielded unit"}` |
| `relative_to_record_creation` | Declassify this many years after the **record containing the information** was created.    | `{"kind":"relative_to_record_creation","years":25}`                   |
| `exemption`                   | An exemption code such as `25X1` or `50X1-HUM`, with `authority` evidence where available. | see below                                                             |

**Relative durations stay relative.** A consumer MUST NOT convert `relative_to_record_creation` into a calendar date using the guide's own `issued` or `effective` date. Each record has its own creation date. A tool MAY compute a date for a specific record when it knows that record's creation date.

**Exemption codes are claims.** Selecting a code does not prove that the exemption was approved or properly incorporated (see ISOO Notice 2025-01). `authority` records where evidence of approval can be found; recording it is not verifying it. Section 7 says how validators flag this.

### 4.7 Authority, review, and history

- `authority` records **claims**: who is expected to sign, and under what delegation (`claimed_delegation.highest_level`, `program`, `evidence`). It is part of the signed payload, so the signer approves what is claimed about them.
- `review` records a **person's** review of whether that claimed authority is real. It is recorded after signing, so it is excluded from the signed payload (section 8). Its `status` is `not_started`, `pending`, `complete`, or `rejected`.
- `history` links earlier revisions (optionally with their payload digests) and records events. Old records MUST NOT be taken as proof of current validity.

A consumer MUST present a verified signature with `review.status` other than `complete` as **"signature valid; authority not verified."**

### 4.8 Extensions

`extensions` holds supplemental data, at guide level or entry level. Each key is a reverse-DNS namespace that the extension's owner controls (for example `org.example.widgets`). Each value has:

- `must_understand`: if `true`, an implementation that does not support this namespace MUST report it as `unsupported` (section 7), which blocks approval. It MUST NOT approve, sign, or present the guide as fully interpreted while ignoring it.
- `version`: optional extension version.
- `data`: any JSON value.

Rules for everyone:

- Consumers MUST preserve extension names and values exactly when they read and rewrite a file, including extensions they do not understand.
- Extensions are inside the signed payload. Changing one changes the digest.
- An extension MUST NOT be used to weaken a profile rule. For example, an extension cannot declare that a classified entry needs no reason.
- Fields not defined by the schema are not allowed anywhere except inside `extensions.*.data`. This is deliberate: an unknown field cannot be silently dropped if it cannot exist.

## 5. Profiles

A profile adds semantic rules on top of the schema. Every guide names one profile.

### 5.1 `cnsi-core`

The government-wide core for classified national security information under E.O. 13526 and 32 CFR 2001.15. Its rules are in section 7.

### 5.2 `dod-5200.45` (unverified)

A placeholder for Department of Defense additions from DoDM 5200.45. In 0.1 it applies exactly the `cnsi-core` rules **plus** a warning that the profile is unverified. It does not claim to capture DoDM requirements, the workbook layout in §5.11(k)(4), or any DTIC submission format. It will change after review by a DoD subject-matter expert.

### 5.3 Atomic Energy Act information

Restricted Data, Formerly Restricted Data and Transclassified Foreign Nuclear Information follow different rules (10 CFR 1045). OpenSCG 0.1 does **not** support them. An entry may set `regime: "aea"` so that the information is identified rather than mislabeled; validators then report it as `unsupported`, which blocks approval.

### 5.4 Unknown profiles

A validator that does not know a guide's `profile` MUST report it as `unsupported`. It MAY still run structural checks.

## 6. Structural validation

Structural validation means checking a file against the JSON Schema for its `schema_version`.

- Validators MUST use JSON Schema draft 2020-12 semantics.
- The `format` keywords `date`, `uri` and `email` MUST be checked (as assertions, not annotations).
- Every schema failure is a finding with code `OSCG-S000` and severity `error`, pointing at the failing field.
- Structural validation comes first. If it fails, semantic checks (section 7) MAY still run, but results on malformed parts are not meaningful.
- Before structural validation, the file is parsed with the strict rules in section 8.2. A file with duplicate member names is rejected even if a lenient parser would accept it.

## 7. Semantic validation

Semantic validation checks rules that the schema cannot express: references between entries, rules that depend on the level, and profile requirements. It runs on a document that has passed structural validation.

### 7.1 Findings

Every check produces zero or more **findings**. A finding has:

| Field      | Meaning                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `code`     | A stable code from 7.3. Codes never change meaning. A retired code is never reused.                                                                                                              |
| `severity` | From 7.2. Fixed per code.                                                                                                                                                                        |
| `pointer`  | An [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer to the exact field. When a required field is missing, the pointer names where it should be (for example `/entries/2/reason`). |
| `message`  | A plain-language explanation. Wording may differ between implementations.                                                                                                                        |

Validators MUST report every applicable finding, not just the first.

### 7.2 Severities

| Severity        | Meaning                                                       | Blocks approval? |
| --------------- | ------------------------------------------------------------- | ---------------- |
| `error`         | Something required is missing or contradictory.               | Yes              |
| `warning`       | Probably fine, but a person should look.                      | No               |
| `unsupported`   | The file uses something this implementation cannot vouch for. | Yes              |
| `policy_review` | Software cannot decide; a responsible person or office must.  | Yes              |

"Blocks approval" means: an implementation MUST NOT freeze a revision as a candidate for signature, sign it, or present it as approval-ready while any blocking finding remains. It MUST still let an author **save** a draft with blocking findings.

A `policy_review` finding stays in the results even after a person resolves it. How the resolution is recorded is outside OpenSCG 0.1; for `OSCG-V046`, recording `document_markings.review.status: "complete"` clears it.

The four categories are deliberately distinct. Missing data (`error`), an unsupported feature (`unsupported`), a decision for a person (`policy_review`), and a cryptographic result (section 9) MUST NOT be merged into a single pass/fail.

### 7.3 Rules for `cnsi-core`

**Identifiers and references**

| Code      | Severity | Rule                                                              |
| --------- | -------- | ----------------------------------------------------------------- |
| OSCG-V001 | error    | Each `entry_id` is unique. Reported at the second and later uses. |
| OSCG-V002 | error    | Each `section_id` is unique.                                      |
| OSCG-V003 | error    | Each value in `references` names an existing `entry_id`.          |
| OSCG-V004 | error    | An entry's `section_id` names an existing section.                |
| OSCG-V005 | error    | An entry does not reference itself.                               |

**Entries**

| Code      | Severity | Rule                                                                                                                                        |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| OSCG-V010 | error    | A classified CNSI entry has a `reason`. (ISOO FY2025: guides lacked specific classification reasoning.)                                     |
| OSCG-V011 | error    | The guide has at least one entry. (ISOO FY2025: guides did not map levels to specific elements.)                                            |
| OSCG-V013 | error    | A classified CNSI entry has a `declassification` instruction. (ISOO FY2025: a guide lacked declassification dates or events.)               |
| OSCG-V014 | error    | In a `level_range`, `lowest` is not above `highest`.                                                                                        |
| OSCG-V015 | warning  | A `level_range` with equal ends should be a `level`.                                                                                        |
| OSCG-V016 | error    | A compilation has `condition_text`.                                                                                                         |
| OSCG-V017 | warning  | A compilation references fewer than two entries.                                                                                            |
| OSCG-V018 | warning  | A compilation's highest level is not above the highest level of every referenced constituent.                                               |
| OSCG-V019 | warning  | An unclassified entry has a `reason` or `declassification`. Not an error, because it may be explanatory; but producers must not require it. |

"Classified" is defined in section 2. A `level_range` whose `highest` is C or above is classified for these rules.

**Declassification**

| Code      | Severity      | Rule                                                                                                                                |
| --------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| OSCG-V020 | policy_review | An `exemption` has no `authority` evidence.                                                                                         |
| OSCG-V021 | policy_review | The exemption code is `50X1-HUM` or `50X2-WMD`, which ISOO Notice 2025-01 treats differently. Raised even when evidence is present. |
| OSCG-V022 | warning       | An exemption gives both `until_date` and `until_event_text`.                                                                        |
| OSCG-V023 | warning       | A `date` instruction is on or before `dates.issued`.                                                                                |

Recording `authority` evidence clears OSCG-V020, but it does not **verify** the exemption. Consumers MUST NOT display an exemption as "approved" or "verified" on the strength of this field.

**Unsupported and unverified**

| Code      | Severity    | Rule                                                                                            |
| --------- | ----------- | ----------------------------------------------------------------------------------------------- |
| OSCG-V030 | unsupported | An entry has `regime: "aea"`.                                                                   |
| OSCG-V031 | unsupported | The `profile` is not known to the implementation.                                               |
| OSCG-V032 | warning     | The profile is `dod-5200.45`, which is unverified (5.2).                                        |
| OSCG-V033 | unsupported | An extension with `must_understand: true` is not supported by the implementation.               |
| OSCG-V034 | warning     | An extension with `must_understand: false` is not recognized. It is preserved, not interpreted. |

**Guide-level content** (32 CFR 2001.15(b) and E.O. 13526 §2.2(b))

| Code      | Severity      | Rule                                                                                                           |
| --------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| OSCG-V040 | error         | The guide has a `subject`.                                                                                     |
| OSCG-V041 | error         | The guide has an `oca`.                                                                                        |
| OSCG-V042 | error         | The guide has a `point_of_contact`.                                                                            |
| OSCG-V043 | error         | `dates` has `issued` or `last_reviewed`.                                                                       |
| OSCG-V044 | error         | `document_markings` has a `banner`.                                                                            |
| OSCG-V045 | error         | If `document_markings.classification` is not `U`, a `classification_authority_block` is present.               |
| OSCG-V046 | policy_review | `document_markings.review.status` is not `complete`.                                                           |
| OSCG-V049 | error         | `oca.highest_level`, if present, is not below the highest level any entry prescribes.                          |
| OSCG-V050 | error         | `authority.claimed_delegation.highest_level`, if present, is not below the highest level any entry prescribes. |
| OSCG-V052 | warning       | The guide prescribes a classified level and has an `oca` without `highest_level`.                              |

These rules compare **claims** with each other. Passing OSCG-V049 means the recorded claim is consistent; it does not mean the person holds that authority.

### 7.4 Rules for `dod-5200.45`

The same as 7.3, plus OSCG-V032.

### 7.5 Loss reports

Any operation that reads an OpenSCG file and writes another representation of it — import, export, migration, a conversion to another format — MUST produce a **loss report**: a list of every value from the original that the result does not preserve. Each item has a JSON Pointer into the original and a kind (`removed` or `changed`).

- An empty loss report is a claim that nothing was lost. It MUST be computed, not assumed.
- An operation MUST NOT present its output as equivalent to a signed revision if its loss report is not empty.
- Rewriting an OpenSCG file (for example, reformatting it) MUST preserve every value, including extensions the implementation does not understand.

**Example.** A spreadsheet export cannot represent entry-level extensions. Its loss report lists `/entries/4/extensions/org.example.rules` as `removed`, and the export is labeled accordingly.

_(Sections 8 onward are added in later drafts: canonical payload, attestations, conformance.)_
