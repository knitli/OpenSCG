# Releasing OpenSCG

A release publishes a tagged version of the schema, specification, conformance suite, and reference library together.

## Before tagging

1. **Synthetic-content review.** A maintainer reads every file added or changed since the last release in `examples/`, `conformance/`, `spec/` and `docs/`, and confirms:
   - [ ] every example and conformance guide has `"synthetic": true` and "SYNTHETIC" in its title (also checked by `test/migrate.test.ts`);
   - [ ] no text is copied from a restricted or non-public government template;
   - [ ] no real program names, people, organizations, or classification rationales appear;
   - [ ] test certificates are labeled `SYNTHETIC … (TEST ONLY)` and no private key is committed.
2. **Claims review.** Search the diff for "compliant", "certified", "approved", "DTIC", and "official". Each use must be accurate and qualified (spec §1.2).
3. **Versions agree.** `package.json` `version`, `spec/VERSION`, `SPEC_VERSION` in `src/index.ts`, and `schema_version` in the schema `const`. The suite version is in `conformance/manifest.json`.
4. **Changelog.** Move "Unreleased" entries under the new version, using the template below.
5. **Proposals.** Proposals accepted under the pre-release rule are reopened for comment (GOVERNANCE.md).
6. CI is green on `main`.

## Tagging

```bash
git tag -s v0.1.0 -m "OpenSCG 0.1.0"
```

```bash
git push origin v0.1.0
```

The release workflow (`.github/workflows/release.yml`) then:

- checks that the tag matches `package.json`;
- runs the full verification;
- packs the npm tarball and `openscg-schema-<version>.tar.gz` (schema, spec, license);
- writes `SHA256SUMS`;
- attaches a GitHub build-provenance attestation to every file;
- creates the GitHub release (marked pre-release for versions with a `-` label);
- publishes to npm **only if** the repository variable `NPM_PUBLISH_ENABLED` is `true`, through the `npm` environment, using trusted publishing with provenance.

## Turning on npm publishing

Do this once, when the project is ready to publish:

1. On npmjs.com, create or claim the `@knitli` scope and add `knitli/OpenSCG`, workflow `release.yml`, environment `npm`, as a **trusted publisher** for `@knitli/openscg`.
2. In GitHub: Settings → Environments → create `npm`, and add required reviewers.
3. Settings → Secrets and variables → Actions → Variables → add `NPM_PUBLISH_ENABLED` = `true`.

No npm token is stored in the repository.

## Verifying a release

Anyone can check a downloaded file:

```bash
sha256sum --check SHA256SUMS
```

```bash
gh attestation verify openscg-schema-0.1.0.tar.gz --repo knitli/OpenSCG
```

For the npm package:

```bash
npm audit signatures
```

## Release notes template

```markdown
## OpenSCG <version> — <date>

**Specification:** <version> · **Schema:** schema/<major.minor>/ · **Conformance suite:** <suite version>

OpenSCG is a proposed open format, not an official government standard.

### Format changes

- <change> — proposal NNNN — breaking / non-breaking

### Conformance suite

- <cases added, fixed>

### Reference library

- <API changes>

### Consultation and review

- <who reviewed, only with their permission; otherwise "No external review is claimed for this release.">

### Known limitations

- DoD profile (`dod-5200.45`) is unverified. No DTIC or DoDM 5200.45 workbook conformance is claimed.
- Atomic Energy Act information is unsupported.
- <others; see docs/open-questions.md>

### Verify this release

sha256sum --check SHA256SUMS
gh attestation verify <file> --repo knitli/OpenSCG
```
