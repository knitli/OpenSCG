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

The library is pre-release. Its API will be documented in this README as each piece lands.

## Status

Pre-release draft (`0.1.0-draft`). See [the implementation plan](docs/plan/IMPLEMENTATION_PLAN.md) for what is planned and what is deliberately out of scope.

## Getting involved

- [How decisions are made](GOVERNANCE.md)
- [How to contribute or propose a change](CONTRIBUTING.md)
- [How to report a security problem](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

**Never post real, controlled, or classified information** in issues, pull requests, or examples. Use invented data only.

## License

Apache-2.0 (see [LICENSE](LICENSE) and [NOTICE](NOTICE)), subject to the legal review noted in the project requirements. "OpenSCG" is a working project name; no trademark clearance has been done.
