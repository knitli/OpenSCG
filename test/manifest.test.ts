// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { type Issued, issue, KU } from "../scripts/test-pki.js";
import {
  type Attestation,
  buildApprovalStatement,
  buildReleaseManifest,
  createAttestation,
  type Guide,
  parseStrict,
  type ReleaseFile,
  signReleaseManifest,
  type TrustPolicy,
  verifyAttestation,
  verifyReleaseManifest,
} from "../src/index.js";

const guideBytes = new Uint8Array(
  readFileSync(new URL("../examples/synthetic-lantern.json", import.meta.url)),
);
const guide = parseStrict(guideBytes) as Guide;
const enc = new TextEncoder();
const files: ReleaseFile[] = [
  { name: "guide.json", media_type: "application/json", role: "guide-json", bytes: guideBytes },
  {
    name: "guide.pdf",
    media_type: "application/pdf",
    role: "rendition-pdf",
    bytes: enc.encode("%PDF-SYNTHETIC"),
  },
  {
    name: "guide.xlsx",
    media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    role: "rendition-xlsx",
    bytes: enc.encode("PK-SYNTHETIC"),
  },
];
const held = () => new Map(files.map((f) => [f.name, f.bytes]));

let root: Issued;
let signer: Issued;
let policy: TrustPolicy;
const valid = { notBefore: "2026-01-01T00:00:00Z", notAfter: "2036-01-01T00:00:00Z" };

beforeAll(async () => {
  root = await issue({
    cn: "SYNTHETIC Ephemeral Root",
    ca: true,
    keyUsage: KU.keyCertSign | KU.cRLSign,
    ...valid,
  });
  signer = await issue({
    cn: "SYNTHETIC Ephemeral Signer",
    issuer: root,
    keyUsage: KU.digitalSignature | KU.nonRepudiation,
    ...valid,
  });
  // No CRL in these tests: local policy accepts unknown revocation explicitly.
  policy = {
    trustAnchors: [root.der],
    unknownRevocation: "accept",
    time: new Date("2026-11-04T00:00:00Z"),
  };
});

const sign = async () =>
  signReleaseManifest(await buildReleaseManifest(guide, files), {
    privateKey: signer.keys.privateKey,
    certificate: signer.der,
  });

describe("release manifests", () => {
  it("verifies when every listed file matches", async () => {
    const r = await verifyReleaseManifest(guide, await sign(), held(), policy);
    expect(r.technically_valid).toBe(true);
    expect(r.files.map((f) => f.status)).toEqual(["ok", "ok", "ok"]);
  });

  it("detects a changed rendition even though its printed digest would be unchanged", async () => {
    const m = held();
    m.set("guide.pdf", enc.encode("%PDF-SYNTHETIC-EDITED"));
    const r = await verifyReleaseManifest(guide, await sign(), m, policy);
    expect(r.files.find((f) => f.name === "guide.pdf")?.status).toBe("mismatch");
    expect(r.signature).toBe("valid");
    expect(r.technically_valid).toBe(false);
  });

  it("reports a missing file instead of assuming it is fine", async () => {
    const m = held();
    m.delete("guide.xlsx");
    const r = await verifyReleaseManifest(guide, await sign(), m, policy);
    expect(r.files.find((f) => f.name === "guide.xlsx")?.status).toBe("missing");
    expect(r.technically_valid).toBe(false);
  });

  it("does not bind to a different revision", async () => {
    const other = { ...guide, revision_id: "2026-r2" };
    const r = await verifyReleaseManifest(other, await sign(), held(), policy);
    expect(r.binding).toBe("mismatch");
    expect(r.technically_valid).toBe(false);
  });

  it("rejects duplicate file names", async () => {
    await expect(buildReleaseManifest(guide, [...files, files[0] as ReleaseFile])).rejects.toThrow(
      /appears twice/,
    );
  });
});

describe("domain separation", () => {
  it("an approval signature is not valid as a manifest signature", async () => {
    const att = await createAttestation({
      statement: await buildApprovalStatement(guide),
      privateKey: signer.keys.privateKey,
      certificate: signer.der,
    });
    const manifest = await buildReleaseManifest(guide, files);
    const r = await verifyReleaseManifest(
      guide,
      { manifest, signature: att.signature },
      held(),
      policy,
    );
    expect(r.signature).toBe("invalid");
  });
});

describe("statement text binding", () => {
  it("a validly signed statement with misleading text does not bind", async () => {
    const honest = await buildApprovalStatement(guide);
    const statement = { ...honest, statement_text: "I approve nothing in particular." };
    const att: Attestation = await createAttestation({
      statement,
      privateKey: signer.keys.privateKey,
      certificate: signer.der,
    });
    const r = await verifyAttestation(guide, att, policy);
    expect(r.signature).toBe("valid");
    expect(r.binding).toBe("mismatch");
    expect(r.binding_problems).toEqual(["statement_text"]);
    expect(r.technically_valid).toBe(false);
  });
});
