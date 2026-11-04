# Security policy

## Reporting a problem

**Do not open a public issue for a security problem.**

Report it privately through GitHub's [private vulnerability reporting](https://github.com/knitli/OpenSCG/security/advisories/new). If you cannot use that, email **hello@knit.li** with the subject line "OpenSCG security".

Please include what you found, how to reproduce it with **synthetic data only**, and what you think the impact is. We aim to acknowledge reports within 3 business days and to agree a disclosure date with you.

## What counts

Problems in the specification are in scope, not just code. Examples:

- Two different guides that canonicalize to the same bytes.
- A way to make a signature over one approval statement verify for another.
- A rule that lets must-understand data be silently dropped.
- A parser in the reference library that can be crashed or made very slow by a crafted file.

## Never send real or classified information

Do not include real, controlled, or classified information in any report, ever. If you believe a real problem can only be shown with real data, tell us that much and stop; we will work out a safe way forward.

## Verifying releases

Each release lists SHA-256 checksums for the schema files and package, and carries a GitHub build-provenance attestation. To check a downloaded file:

```bash
gh attestation verify <file> --repo knitli/OpenSCG
```

The npm package is published with npm provenance. To check it:

```bash
npm audit signatures
```
