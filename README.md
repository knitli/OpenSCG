# OpenSCG

OpenSCG is an open, machine-readable format for **security classification guides (SCGs)**: a JSON Schema, a plain-language specification of what each field means, and a suite of test files that any tool can check itself against.

> **OpenSCG is not an official government standard.** It is a proposed interchange format, maintained in the open. A file that passes every OpenSCG check is well-formed and internally consistent. That does not make it lawful, approved, or correct classification guidance. Those are decisions for the responsible people and agencies.

## Why it exists

The [ISOO FY2025 Annual Report](https://www.archives.gov/files/isoo/reports/isoo-fy-2025-annual-report-final-508.pdf) (pp. 6–8) reviewed ten SCGs and found guides that did not map levels to specific elements, guides missing declassification instructions, and guides missing classification reasoning. A structured format can make those gaps visible before a guide is approved. It cannot fill them in.

## What is in this repository

| Path                | What it is                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `schema/`           | JSON Schema (draft 2020-12) files, one directory per version                              |
| `spec/`             | The semantic specification: meanings, rules, canonical form, signing contract             |
| `conformance/`      | Valid and invalid test files, each with its expected result                               |
| `examples/`         | Complete synthetic guides. **Every example is invented.**                                 |
| `src/`              | The TypeScript reference library (`@knitli/openscg` on npm)                               |
| `consumers/python/` | An independent second implementation used to test that the published materials are enough |
| `docs/`             | Plan, proposals, and project documentation                                                |

## Using it without this library

You do not need our code. Any JSON Schema 2020-12 validator can check structure using the files in `schema/`. The semantic rules in `spec/` are written so another implementation can follow them, and `conformance/` tells you whether you got them right.

## Using the reference library

```bash
npm install @knitli/openscg
```

The library is pre-release; names may change before 1.0.

```ts
import { parseStrict, validate, isApprovalReady, payloadDigest } from "@knitli/openscg";

const guide = parseStrict(fileBytes); // rejects duplicate keys, bad UTF-8, …
const findings = validate(guide); // [{ code, severity, pointer, message }, …]
const ready = isApprovalReady(findings); // false if any error / unsupported / policy_review
const digest = await payloadDigest(guide); // { alg: "sha-256", value: "…" }
```

| Function                                         | What it does                                                                                                           | Spec  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----- |
| `parseStrict(bytes)`                             | Parses JSON, rejecting anything that could be read two ways.                                                           | §8.2  |
| `validateStructure(doc)`                         | JSON Schema checks only.                                                                                               | §6    |
| `validate(doc)`                                  | Structural, then semantic checks.                                                                                      | §7    |
| `compareForLoss(before, after)`                  | Lists what a conversion did not preserve.                                                                              | §7.5  |
| `canonicalize(value)`                            | RFC 8785 canonical bytes.                                                                                              | §8.3  |
| `payloadDigest(guide)`                           | SHA-256 of the signed payload.                                                                                         | §8.5  |
| `buildApprovalStatement(guide)`                  | The statement a signer approves.                                                                                       | §9.1  |
| `verifyAttestation(guide, att, policy)`          | Checks binding, signature, algorithm, key usage, validity, trust, revocation, and reports authority review separately. | §9.4  |
| `buildReleaseManifest` / `verifyReleaseManifest` | Signed list of released file hashes, for PDF and workbook renditions.                                                  | §10.3 |

Signing keys are never created or stored by this library. `createAttestation()` and `signDetached()` take a key the caller already holds, for test vectors and for signing interfaces that expose a Web Crypto key.

## Status

Pre-release draft (`0.1.0-draft`). See [the implementation plan](docs/plan/IMPLEMENTATION_PLAN.md), [requirements traceability](docs/requirements-traceability.md), and [open questions](docs/open-questions.md).

| Document                                         | What it covers                  |
| ------------------------------------------------ | ------------------------------- |
| [`spec/openscg.md`](spec/openscg.md)             | The specification               |
| [`spec/conformance.md`](spec/conformance.md)     | How to test an implementation   |
| [`spec/compatibility.md`](spec/compatibility.md) | Versions, extensions, migration |

## Getting involved

- [How decisions are made](GOVERNANCE.md)
- [How to contribute or propose a change](CONTRIBUTING.md)
- [How to report a security problem](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

**Never post real, controlled, or classified information** in issues, pull requests, or examples. Use invented data only.

## License

Apache-2.0 (see [LICENSE](LICENSE) and [NOTICE](NOTICE)), subject to the legal review noted in the project requirements. "OpenSCG" is a working project name; no trademark clearance has been done.
