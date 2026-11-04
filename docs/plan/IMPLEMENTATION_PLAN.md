# OpenSCG implementation plan

**Status:** Working plan, November 4, 2026. Not legal advice.
**Scope:** OpenSCG only — the schema, the semantic specification, the conformance suite, and a small reference library. Imprint (the authoring application) is a separate project and is out of scope here, except where this plan names what Imprint consumes.

## What OpenSCG is, in one paragraph

OpenSCG is a public, versioned file format for security classification guides (SCGs). It has four parts:

1. **A JSON Schema** (draft 2020-12) that says what a well-formed file looks like.
2. **A semantic specification** that says what the fields mean and which rules a schema cannot express — for example, "a reference must point at an entry that exists."
3. **A conformance suite**: valid and invalid sample files, each with the result a correct implementation must produce.
4. **A reference library** (TypeScript, published to npm) that implements the rules, so other tools do not have to start from zero.

OpenSCG is a _proposed_ interchange format. It is not an official government standard. A file that passes every check is well-formed and internally consistent. It is not thereby lawful, approved, or correct guidance; those remain human decisions.

## Requirements this plan covers

The requirements document (§5) lists six schema requirements (S-01 to S-06) and five governance requirements (G-01 to G-05). Each phase below names which ones it moves forward. "Done" means the acceptance criterion in the requirements can be demonstrated from this repository.

| ID   | Short name                                                         | Phase |
| ---- | ------------------------------------------------------------------ | ----- |
| S-01 | Versioned schema, stable `$id`, semantic spec                      | 1     |
| S-02 | Core concepts and profiles                                         | 1     |
| S-03 | Structural vs semantic rules; extensions; loss handling            | 2     |
| S-04 | Canonical bytes, digest, approval statement, detached verification | 3     |
| S-05 | Conformance fixtures, test procedure, independent consumer         | 4     |
| S-06 | Compatibility, extension namespaces, migration                     | 5     |
| G-01 | Own repo, own package, open license                                | 0     |
| G-02 | Governance document                                                | 0     |
| G-03 | Proposal process, versioning, deprecation                          | 0, 5  |
| G-04 | Security disclosure, release provenance, synthetic-only examples   | 0, 5  |
| G-05 | Practitioner feedback without implied endorsement                  | 0, 5  |

## Technology choices

| Choice                                                       | Why                                                                                                                                                                                                                                        | What would change it                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| JSON Schema 2020-12                                          | Required by S-01; widely supported in every major language.                                                                                                                                                                                | Nothing planned.                                                                                               |
| TypeScript reference library on Node 22+                     | Imprint's likely UI stack is TypeScript; one library can serve a browser and a server.                                                                                                                                                     | If practitioners mostly use Python tooling, add a Python package later. The spec never depends on the library. |
| [Ajv](https://ajv.js.org/) for structural validation         | Mature, fast, supports 2020-12.                                                                                                                                                                                                            | —                                                                                                              |
| Hand-written RFC 8785 canonicalizer **with a strict parser** | Off-the-shelf canonicalizers accept duplicate member names silently (because `JSON.parse` does). The spec requires rejecting them, so the parser has to be ours. Number formatting reuses the ECMAScript algorithm, which RFC 8785 adopts. | —                                                                                                              |
| [PKI.js](https://pkijs.org/) for CMS (RFC 5652)              | The requirements say not to hand-build CMS or DER. PKI.js is a maintained implementation that runs in Node and browsers.                                                                                                                   | A different mature CMS library if review finds a problem.                                                      |
| Python + OpenSSL independent consumer                        | S-05 needs a second implementation that uses only public materials. Python's `jsonschema` and OpenSSL's `cms -verify` share no code with the TypeScript library.                                                                           | —                                                                                                              |
| Biome (lint + format), Vitest (tests), npm (package manager) | Familiar to outside contributors; few moving parts.                                                                                                                                                                                        | —                                                                                                              |
| Apache-2.0                                                   | Recommended in the requirements (§9), subject to legal review. Already in `LICENSE`.                                                                                                                                                       | Counsel's review.                                                                                              |

## Phases

Each phase is one pull request, stacked on the one before it. Each PR has to leave `npm run verify` green.

### Phase 0 — Bootstrap (G-01, G-02, G-03, G-04, G-05)

**Delivers:** this plan; README; `GOVERNANCE.md`; `CONTRIBUTING.md`; `SECURITY.md`; `CODE_OF_CONDUCT.md`; proposal template; issue and PR templates; lint, format and type-check configuration; CI on every push and PR; a release workflow that is ready to publish to npm with provenance but stays switched off until a maintainer turns it on.

**How the release switch works.** Pushing a tag like `v0.1.0` runs the release workflow. It always builds, tests, packs, and attaches the tarball, the schema files and their SHA-256 checksums to a GitHub release, with a build-provenance attestation. It publishes to npm _only_ when the repository variable `NPM_PUBLISH_ENABLED` is `true` and the `npm` environment approves the run. Until then, a tag produces a verifiable GitHub release and nothing else.

**Done when:** a fresh contributor can find the license, governance, disclosure path, and how to propose a change; CI is green.

### Phase 1 — Schema and core model (S-01, S-02)

**Delivers:** `schema/0.1/guide.schema.json` with a stable `$id`; `spec/openscg.md` (the semantic specification, sections 1–6); synthetic examples, including the compilation example from the requirements; library function `validateStructure()`.

**Model, in short:**

- **Guide:** `guide_id`, `revision_id`, `schema_version`, `profile`, title, scope, issuing organization, point of contact, original classification authority (OCA) with position or personal identifier, dates, lifecycle state, supersession links.
- **Document protection:** the guide's _own_ classification and markings, kept apart from the guidance it contains.
- **Entries:** stable `entry_id`, a precise description, one level (U/C/S/TS) or an explicitly described level range, controls, reason with §1.4 categories, declassification instruction, sources, optional explanatory statements.
- **Compilation entries:** narrative condition, constituent references, resulting protection.
- **Authority and history:** claimed signer, claimed delegation, review status (pending/complete) — never "verified" just because a signature checks out.
- **Extensions:** namespaced, with a `must_understand` flag.

**Profiles.** `cnsi-core` is the government-wide core (E.O. 13526 and 32 CFR 2001.15). `dod-5200.45` is a placeholder for DoD-specific additions; it is marked _unverified_ until a DoD subject-matter expert reviews it. Atomic Energy Act data (RD/FRD/TFNI) is explicitly unsupported: a file can carry the marker, and validation must then block approval with an explanation.

**Done when:** a consumer can validate every example with any 2020-12 validator, without installing this library.

### Phase 2 — Semantic validation, extensions and loss reporting (S-03)

**Delivers:** spec sections on semantic rules, finding codes and severities; library function `validate()` that runs structural then semantic checks and returns findings with a stable code, a severity, and a JSON Pointer to the exact field.

**Severities:**

- `error` — blocks approval. A draft can still be saved with errors.
- `warning` — a person must review it.
- `unsupported` — the file uses something this version cannot vouch for (for example, AEA data, or an unknown must-understand extension). Blocks approval.
- `policy_review` — the software cannot decide; a policy office must (for example, an exemption code without approval evidence).

**Rules include:** duplicate IDs; dangling references; classified entry without reason or categories; classified entry without a declassification instruction; level range without stated conditions; exemption code without evidence; unknown must-understand extension; each of the three FY2025 ISOO failure patterns.

**Loss reporting.** A function that converts or rewrites a file must return a _loss report_ listing anything it could not carry over. An empty report is a claim that nothing was lost.

**Done when:** fixtures exercise each rule, and a valid unclassified entry does not need classified-only fields.

### Phase 3 — Canonical bytes, digest, approval statement, attestation (S-04)

**Delivers:** spec sections on the signed payload and verification; library functions `canonicalize()`, `digest()`, `approvalStatement()`, `verifyAttestation()`; published test vectors.

**Key decisions:**

- **Payload:** the whole guide object minus a short list of excluded top-level members (`attestations`, `review`). Spelled out in the spec so producer and verifier agree.
- **Canonical form:** RFC 8785 (JCS), UTF-8. The parser rejects duplicate member names, lone surrogates, and numbers it cannot represent exactly.
- **Digest:** SHA-256 over the canonical bytes. The digest is never inside the bytes it covers.
- **Approval statement:** its own small JSON object (purpose, guide ID, revision ID, profile, digest algorithm and value, payload format version, signer context), canonicalized with JCS and prefixed with a fixed domain-separation string, so a signature over a guide can never be mistaken for a signature over anything else.
- **Attestation:** a detached CMS SignedData over the approval-statement bytes. The verification report keeps four results separate: _signature_, _trust chain_, _revocation status_, and _authority review_. A valid signature with no completed authority review reports "signature valid; authority not verified."
- **Renditions (PDF, XLSX):** must display guide ID, revision ID and payload digest. The spec says plainly that a matching displayed digest does not prove the rendition is faithful. A separate signed release manifest can list rendition file hashes.

**Test vectors** use a synthetic certificate authority created only for this repository. Its private keys are published on purpose and are labeled as test-only.

**Done when:** the TypeScript library and the independent Python consumer produce identical canonical bytes and digests, both verify the signature vectors, and every mutated vector fails.

### Phase 4 — Conformance suite and independent consumer (S-05)

**Delivers:** `conformance/` with a manifest of cases (file, expected outcome, expected finding codes); `spec/conformance.md` (the versioned test procedure); a runner for the reference library; `consumers/python/`, an independent consumer that uses only the published schema, spec and fixtures.

**Honest limit:** the Python consumer is written by the same project. It proves the materials are _sufficient_ for a second implementation; it does not prove third-party adoption. The acceptance criterion asks for "at least one independent consumer"; true independence needs an outside implementer, which is tracked as an open item.

**Done when:** both implementations pass the full suite in CI.

### Phase 5 — Compatibility, migration, and release governance (S-06, G-03, G-04, G-05)

**Delivers:** `spec/compatibility.md` (what counts as a breaking change, extension namespace rules, deprecation); a migration interface with loss reporting and one worked example; two sample proposals (one non-breaking, one breaking) taken through the process; release notes template; checksum and provenance verification instructions; public-sample review checklist.

**Done when:** published compatibility examples cover accepted and rejected changes, and a migration reports what it cannot preserve.

## What OpenSCG deliberately does not do

- Decide whether information is classified, or at what level.
- Verify OCA delegation. It records a _claim_ and whether a person has reviewed it.
- Claim compliance with any law, regulation, or agency manual.
- Claim DTIC compatibility. No official DTIC template has been inspected.
- Support AEA (RD/FRD/TFNI) semantics. Such data is flagged as unsupported.
- Execute compilation or conditional rules. Conditions are human-readable text.
- Include any real, restricted, or classified content. All examples are synthetic.

## Open questions with owners

| Question                                                     | Why it matters                                                                                                                  | Owner                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Which host will resolve the schema `$id`?                    | The `$id` is an identifier and does not need to resolve, but a resolvable URL helps consumers. Domain clearance is outstanding. | Project owner                      |
| Is Apache-2.0 confirmed after legal review?                  | G-01.                                                                                                                           | Counsel                            |
| Do practitioners recognize the field vocabulary?             | Phase 0 exit gate in the requirements.                                                                                          | Project owner, with SCG authors    |
| What does the DoD profile need beyond the core?              | DoDM 5200.45 §5.11(k)(4).                                                                                                       | DoD subject-matter expert          |
| Who will build the first truly third-party consumer?         | S-05.                                                                                                                           | Maintainers, through outreach      |
| Which signing interfaces produce CMS acceptable to agencies? | S-04 is format-level; real interfaces are an Imprint dependency.                                                                | Imprint project, agency PKI owners |
