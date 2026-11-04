# Open questions

Unresolved questions that affect what OpenSCG says. Each has an owner and the trigger that would resolve it. Release notes link here instead of implying these are settled.

## Domain questions (need practitioners)

| #   | Question                                                                                        | Why it matters                   | Owner                       | Resolved by                            |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------- | -------------------------------------- |
| D1  | Do SCG authors and OCAs recognize the field names and structure?                                | Requirements phase 0 exit gate.  | Project owner               | Interviews with SCG authors and an OCA |
| D2  | Is a single `condition_text` enough for level ranges, or do authors think per level?            | Proposal 0002.                   | Maintainers                 | Practitioner feedback on 0002          |
| D3  | Which handling caveats and control markings belong in `controls`, and is the `kind` list right? | 32 CFR 2001.15(b)(6).            | Maintainers                 | Practitioner review                    |
| D4  | How should markings review (`OSCG-V046`) be recorded for real deployments?                      | Today it is a status field only. | Classification policy staff | Policy review                          |
| D5  | How should exemption evidence be referenced (ISCAP approval, agency notice)?                    | ISOO Notice 2025-01.             | Classification policy staff | Policy review                          |
| D6  | What must the DoD profile add beyond the core?                                                  | DoDM 5200.45 §5.11(k)(4).        | DoD subject-matter expert   | Expert review                          |

## Official-format mappings (all unverified)

| Mapping                               | Status                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| DoDM 5200.45 workbook (.xlsx) layout  | **Unverified.** No authoritative template has been inspected. OpenSCG defines no workbook layout (spec §10.4). |
| DTIC submission format / DD Form 2024 | **Unverified.** No official specification has been inspected. No compatibility is claimed.                     |
| AEA (RD / FRD / TFNI)                 | **Unsupported.** Flagged as `OSCG-V030`.                                                                       |

## Technical questions

| #   | Question                                                                                                 | Owner                          |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------ |
| T1  | Which host will resolve the schema `$id` (`openscg.knitli.com`)? Domain clearance is outstanding.        | Project owner                  |
| T2  | Is the default key-usage rule (require `nonRepudiation`) right for agency document-signing certificates? | Agency PKI owners, via Imprint |
| T3  | Should OCSP be supported alongside offline CRLs?                                                         | Maintainers                    |
| T4  | Should canonicalization reject non-integer numbers that are not exactly representable?                   | Maintainers                    |

## Project questions

| #   | Question                                             | Owner                         |
| --- | ---------------------------------------------------- | ----------------------------- |
| P1  | Is Apache-2.0 confirmed after legal review?          | Counsel                       |
| P2  | Who will build the first truly third-party consumer? | Maintainers, through outreach |
| P3  | Trademark clearance for "OpenSCG".                   | Counsel                       |
