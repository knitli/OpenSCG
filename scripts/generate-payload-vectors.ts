// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Generates conformance/vectors/payload/ from the synthetic examples.
// Run: npm run vectors:payload
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  approvalStatementBytes,
  buildApprovalStatement,
  parseStrict,
  payloadBytes,
  payloadDigest,
  sha256,
} from "../src/index.js";
import type { Guide } from "../src/types.js";

const OUT = "conformance/vectors/payload";
const cases = [];
for (const file of readdirSync("examples")
  .filter((f) => f.endsWith(".json"))
  .sort()) {
  const id = file.replace(/\.json$/, "");
  const guide = parseStrict(readFileSync(`examples/${file}`)) as Guide & {
    authority?: { claimed_signer?: object };
  };
  writeFileSync(`${OUT}/${id}.payload.jcs`, payloadBytes(guide));
  const entry: Record<string, unknown> = {
    id,
    guide: `../../../examples/${file}`,
    payload: `${id}.payload.jcs`,
    payload_digest: await payloadDigest(guide),
  };
  if (guide.authority?.claimed_signer) {
    const statement = await buildApprovalStatement(guide);
    const bytes = approvalStatementBytes(statement);
    writeFileSync(`${OUT}/${id}.statement.bin`, bytes);
    entry.statement = `${id}.statement.bin`;
    entry.statement_digest = await sha256(bytes);
  }
  cases.push(entry);
}
writeFileSync(
  `${OUT}/manifest.json`,
  `${JSON.stringify(
    {
      description:
        "Payload and approval-statement vectors. For each case: parse <guide> strictly, remove the excluded top-level members, canonicalize with RFC 8785, and compare with <payload> byte-for-byte; its SHA-256 is <payload_digest>. Where present, <statement> is the exact signed bytes (domain prefix + canonical statement) built from authority.claimed_signer.",
      spec_version: "0.1.0",
      excluded_members: ["attestations", "review"],
      cases,
    },
    null,
    2,
  )}\n`,
);
