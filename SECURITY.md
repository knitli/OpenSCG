# Security policy

This policy extends Knitli's [organizational security policy](https://knitli.com/security/); please see that reference for detailed instructions on reporting, vulnerability disclosures, and other security information.

## Never send real or classified information

Do not include real, controlled, or classified information in any report, ever. If you believe a real problem can only be shown with real data, tell us "I think you need to see real data to understand the problem." We will figure out a way ahead from there.

## Verifying releases

Each release lists SHA-256 checksums for the schema files and package, and carries a GitHub build-provenance attestation. To check a downloaded file:

```bash
gh attestation verify <file> --repo knitli/OpenSCG
```

The npm package is published with npm provenance. To check it:

```bash
npm audit signatures
```
