# OpenSCG governance

This document says who makes decisions about OpenSCG, how, and how that is expected to change.

## Current stewardship

OpenSCG is started and currently stewarded by **Knitli Inc.** We say this plainly because the project is not yet independent, and we do not want to imply that it is.

**Current maintainers**

| Name            | GitHub       | Role            |
| --------------- | ------------ | --------------- |
| Adam Poulemanos | @bashandbone | Lead maintainer |

Maintainers review and merge changes, cut releases, and run the proposal process. The lead maintainer breaks ties.

## The aim: community control

The goal is for OpenSCG to be governed by the people who write, approve, and consume SCGs, not by any one company. Concretely, we will:

1. Add maintainers from outside Knitli once there are sustained outside contributors. Any maintainer may nominate one; existing maintainers decide by consensus.
2. Once there are at least three maintainers, and at least one is not employed by Knitli, decisions move from "lead maintainer breaks ties" to a majority vote of maintainers.
3. Consider moving the project to a neutral foundation when there is enough adoption to justify it.

None of these steps has happened yet.

## How decisions are made

**Small changes** — typo fixes, clearer wording, new test fixtures that do not change any rule — need one maintainer's approval.

**Changes to the format** — anything that changes what is valid, what a field means, or how canonical bytes or signatures work — go through a written proposal. See [docs/proposals/README.md](docs/proposals/README.md).

1. Anyone opens a proposal as a pull request using the template.
2. It stays open for comment for at least **14 days** (at least **30 days** for a breaking change).
3. Every proposal must include: compatibility impact, security review, new or changed test vectors, and a migration note if it breaks anything.
4. Maintainers accept, reject, or ask for changes, and record their reasons in the proposal.

## Disagreements

Raise it on the issue or pull request first. If that does not resolve it, ask the maintainers to decide; they will write down their reasoning. If you think the process itself was not followed, open an issue labeled `governance`.

## What participation does not imply

Taking part in OpenSCG — commenting, contributing, or being thanked in release notes — does not mean you or your organization endorse it. We name reviewers only with their permission. No government agency endorses OpenSCG.

## Relationship to Imprint

Imprint is a separate application, also from Knitli, that implements OpenSCG. OpenSCG does not depend on Imprint, and Imprint gets no special say in OpenSCG decisions. Imprint changes go through this same process if they need changes to the format.
