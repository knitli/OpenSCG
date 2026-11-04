// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Attestation,
  fromPem,
  type Guide,
  parseStrict,
  verifyAttestation,
} from "../src/index.js";

const dir = new URL("../conformance/vectors/attestation/", import.meta.url);
const read = (f: string) => readFileSync(new URL(f, dir), "utf8");
const manifest = JSON.parse(read("manifest.json"));
// biome-ignore lint/suspicious/noExplicitAny: manifest entries are untyped JSON
type Case = any;
const pem = (f: string, label: string) => fromPem(read(f), label);

describe("attestation vectors", () => {
  it.each<[string, Case]>(manifest.cases.map((c: Case) => [c.id, c] as [string, Case]))(
    "%s",
    async (_id, c) => {
      const guide = parseStrict(read(c.guide)) as Guide & { attestations: Attestation[] };
      const report = await verifyAttestation(guide, guide.attestations[0] as Attestation, {
        trustAnchors: c.trust_anchors.flatMap((f: string) => pem(f, "CERTIFICATE")),
        crls: c.crls.flatMap((f: string) => pem(f, "X509 CRL")),
        unknownRevocation: c.unknown_revocation ?? "fail",
        time: new Date(manifest.verify_at),
      });
      expect(report).toMatchObject(c.expected);
      if (c.expected.technically_valid && c.expected.authority === "not_verified") {
        expect(report.summary).toMatch(/^Signature valid; authority not verified\./);
      }
      if (!c.expected.technically_valid) expect(report.summary).toMatch(/^Not valid:/);
    },
  );

  it("every failing case fails for a reason distinct from the others", () => {
    const failing = manifest.cases.filter(
      (c: { expected: { technically_valid: boolean } }) => !c.expected.technically_valid,
    );
    const signatures = failing.map((c: { expected: object }) => JSON.stringify(c.expected));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("rejects an attestation whose signature field is not base64", async () => {
    const valid = parseStrict(read("valid.json")) as Guide & { attestations: Attestation[] };
    const att = { ...(valid.attestations[0] as Attestation), signature: "@@@" };
    const r = await verifyAttestation(valid, att, {
      trustAnchors: pem("root.pem", "CERTIFICATE"),
      time: new Date(manifest.verify_at),
    });
    expect(r.signature).toBe("malformed");
    expect(r.technically_valid).toBe(false);
  });

  it("reports a rejected authority review distinctly", async () => {
    const valid = parseStrict(read("valid.json")) as Guide & { attestations: Attestation[] };
    const g = { ...valid, review: { status: "rejected" } };
    const r = await verifyAttestation(g, valid.attestations[0] as Attestation, {
      trustAnchors: pem("root.pem", "CERTIFICATE"),
      crls: pem("root.crl.pem", "X509 CRL"),
      time: new Date(manifest.verify_at),
    });
    expect(r.technically_valid).toBe(true);
    expect(r.authority).toBe("review_rejected");
    expect(r.summary).toContain("REJECTED");
  });

  it("treats a stale CRL as unknown", async () => {
    const valid = parseStrict(read("valid.json")) as Guide & { attestations: Attestation[] };
    const r = await verifyAttestation(valid, valid.attestations[0] as Attestation, {
      trustAnchors: pem("root.pem", "CERTIFICATE"),
      crls: pem("root.crl.pem", "X509 CRL"),
      time: new Date("2035-12-31T12:00:00Z"),
    });
    expect(r.revocation).toBe("unknown");
    expect(r.technically_valid).toBe(false);
  });
});
