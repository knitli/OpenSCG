# Contributing to OpenSCG

Thank you for helping. You do not need to be a developer: the most valuable contributions right now come from people who write, approve, or use classification guides.

## The one rule

**Use synthetic data only.** Never put real, controlled, or classified information — or text copied from a restricted government template — in an issue, pull request, test fixture, or example. Invent it. Label it `SYNTHETIC`.

## Ways to help

- **Tell us what is wrong with the vocabulary.** Open an issue with the "Practitioner feedback" template.
- **Report a bug** in the schema, spec, or library.
- **Propose a change to the format.** See [docs/proposals/README.md](docs/proposals/README.md).
- **Write another implementation.** If you build a validator or reader in another language, tell us; it is the best test the spec can get.

## Development setup

You need Node.js 22 or later. For the Python consumer, you also need [uv](https://docs.astral.sh/uv/) and OpenSSL 3.

```bash
npm ci
```

```bash
npm run verify
```

`verify` runs lint and format checks, type checks, tests, and the build. CI runs the same thing.

To fix formatting and safe lint issues automatically:

```bash
npx biome check --write .
```

## Tests must be able to fail

A test that cannot fail hides the bug it was written to catch. When you add or change a test, break the thing it checks — mutate the fixture, or temporarily revert the fix — and confirm the test goes red. Then restore it. Say in your pull request that you did this.

Prefer mutating **inputs** (a fixture with a missing field, a flipped byte) over editing library source.

## Pull requests

- Keep each pull request to one change.
- Changes to what is valid, what a field means, or how signing works need a proposal first.
- Add a line to `CHANGELOG.md` under "Unreleased".
- Every new file starts with an SPDX header where the format allows comments:

  ```
  SPDX-FileCopyrightText: 2026 Knitli Inc.
  SPDX-License-Identifier: Apache-2.0
  ```

## Licensing of contributions

Contributions are accepted under the Apache-2.0 license (the "inbound = outbound" rule in section 5 of the license). By opening a pull request, you confirm you have the right to contribute it, including any rights your employer holds. Add a `Signed-off-by` line to each commit (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/).

## Writing style

Write for a reader who is smart but new to the topic. Short sentences. Define terms. Say what a check proves and what it does not.
