// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Generates conformance/vectors/attestation/. Run: npm run vectors:attestation
//
// Everything here is SYNTHETIC. A throwaway certificate authority is created
// in memory, used to sign the vectors, and discarded. Private keys are never
// written to disk. Regenerating produces new keys and signatures, so only do
// it deliberately, and commit the result as one change.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildApprovalStatement, createAttestation, toPem } from "../src/index.js";
import type { Guide } from "../src/types.js";
import { crl, type Issued, issue, KU } from "./test-pki.js";

const OUT = "conformance/vectors/attestation";
const write = (file: string, text: string) => writeFileSync(`${OUT}/${file}`, text);
const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const valid = { notBefore: "2026-01-01T00:00:00Z", notAfter: "2036-01-01T00:00:00Z" };
  const root = await issue({
    cn: "SYNTHETIC Test Root CA (TEST ONLY)",
    ca: true,
    keyUsage: KU.keyCertSign | KU.cRLSign,
    ...valid,
  });
  const otherRoot = await issue({
    cn: "SYNTHETIC Untrusted Root CA (TEST ONLY)",
    ca: true,
    keyUsage: KU.keyCertSign | KU.cRLSign,
    ...valid,
  });
  const docKU = KU.digitalSignature | KU.nonRepudiation;
  const signer = await issue({
    cn: "SYNTHETIC Casey Sample (TEST ONLY)",
    issuer: root,
    keyUsage: docKU,
    ...valid,
  });
  const expired = await issue({
    cn: "SYNTHETIC Expired Signer (TEST ONLY)",
    issuer: root,
    keyUsage: docKU,
    notBefore: "2026-01-01T00:00:00Z",
    notAfter: "2026-06-01T00:00:00Z",
  });
  const revoked = await issue({
    cn: "SYNTHETIC Revoked Signer (TEST ONLY)",
    issuer: root,
    keyUsage: docKU,
    ...valid,
  });
  const authOnly = await issue({
    cn: "SYNTHETIC Authentication-Only (TEST ONLY)",
    issuer: root,
    keyUsage: KU.digitalSignature,
    clientAuthOnly: true,
    ...valid,
  });
  const foreign = await issue({
    cn: "SYNTHETIC Foreign Signer (TEST ONLY)",
    issuer: otherRoot,
    keyUsage: docKU,
    ...valid,
  });
  const rsaSigner = await issue({
    cn: "SYNTHETIC RSA SHA-1 Signer (TEST ONLY)",
    issuer: root,
    keyUsage: docKU,
    rsa: true,
    ...valid,
  });

  write("root.pem", toPem(root.der, "CERTIFICATE"));
  write("other-root.pem", toPem(otherRoot.der, "CERTIFICATE"));
  write(
    "root.crl.pem",
    toPem(await crl(root, [revoked], "2026-10-01T00:00:00Z", "2035-12-31T00:00:00Z"), "X509 CRL"),
  );

  const guide = JSON.parse(readFileSync("examples/synthetic-lantern.json", "utf8")) as Guide;
  const statement = await buildApprovalStatement(guide);
  const signingTime = new Date("2026-11-01T12:00:00Z");
  const sign = (who: Issued, hash: "SHA-1" | "SHA-256" = "SHA-256") =>
    createAttestation({
      statement,
      privateKey: who.keys.privateKey,
      certificate: who.der,
      hash,
      signingTime,
    });

  const good = await sign(signer);
  const withAtt = (g: Guide, att: unknown) => ({ ...g, attestations: [att] });

  const cases: Record<string, unknown>[] = [];
  const add = (
    id: string,
    description: string,
    doc: unknown,
    policy: Record<string, unknown>,
    expected: Record<string, unknown>,
  ) => {
    write(`${id}.json`, json(doc));
    cases.push({ id, description, guide: `${id}.json`, ...policy, expected });
  };
  const trusted = { trust_anchors: ["root.pem"], crls: ["root.crl.pem"] };
  const ok = {
    binding: "ok",
    signature: "valid",
    algorithm: "permitted",
    key_usage: "permitted",
    validity: "ok",
    trust: "trusted",
    revocation: "good",
  };

  add("valid", "Valid signature; no authority review recorded.", withAtt(guide, good), trusted, {
    ...ok,
    authority: "not_verified",
    technically_valid: true,
  });

  add(
    "valid-review-complete",
    "Same attestation; a human authority review is recorded afterwards. review is outside the payload, so the signature still verifies.",
    withAtt(
      {
        ...guide,
        review: {
          status: "complete",
          reviewed_by: "SYNTHETIC Security Office",
          reviewed_on: "2026-11-02",
        },
      } as Guide,
      good,
    ),
    trusted,
    { ...ok, authority: "review_complete", technically_valid: true },
  );

  const altered = structuredClone(guide);
  (altered.entries[2] as { level: string }).level = "C";
  add("altered-payload", "An entry was changed after signing.", withAtt(altered, good), trusted, {
    ...ok,
    binding: "mismatch",
    authority: "not_verified",
    technically_valid: false,
  });

  const badStatement = { ...good, statement: { ...good.statement, revision_id: "2026-r9" } };
  add(
    "altered-statement",
    "The stored statement was edited after signing.",
    withAtt({ ...guide, revision_id: "2026-r9" } as Guide, badStatement),
    trusted,
    {
      ...ok,
      binding: "mismatch",
      signature: "invalid",
      authority: "not_verified",
      technically_valid: false,
    },
  );

  const sigBytes = Uint8Array.from(atob(good.signature), (c) => c.charCodeAt(0));
  sigBytes[sigBytes.length - 5] = (sigBytes[sigBytes.length - 5] ?? 0) ^ 0x01;
  let s = "";
  for (const b of sigBytes) s += String.fromCharCode(b);
  add(
    "tampered-signature",
    "One bit of the signature value was flipped.",
    withAtt(guide, { ...good, signature: btoa(s) }),
    trusted,
    { ...ok, signature: "invalid", authority: "not_verified", technically_valid: false },
  );

  add(
    "wrong-trust-anchor",
    "Signed by a certificate from a root the verifier does not trust.",
    withAtt(guide, await sign(foreign)),
    trusted,
    {
      ...ok,
      trust: "untrusted",
      revocation: "not_checked",
      authority: "not_verified",
      technically_valid: false,
    },
  );

  add(
    "expired",
    "The signer certificate expired before the verification time.",
    withAtt(guide, await sign(expired)),
    trusted,
    { ...ok, validity: "expired", authority: "not_verified", technically_valid: false },
  );

  add(
    "revoked",
    "The signer certificate is listed on the CRL.",
    withAtt(guide, await sign(revoked)),
    trusted,
    { ...ok, revocation: "revoked", authority: "not_verified", technically_valid: false },
  );

  add(
    "revocation-unknown",
    "No CRL is available; default policy fails closed.",
    withAtt(guide, good),
    { trust_anchors: ["root.pem"], crls: [] },
    { ...ok, revocation: "unknown", authority: "not_verified", technically_valid: false },
  );

  add(
    "revocation-unknown-accepted",
    "No CRL is available; local policy explicitly accepts unknown status.",
    withAtt(guide, good),
    { trust_anchors: ["root.pem"], crls: [], unknown_revocation: "accept" },
    { ...ok, revocation: "unknown", authority: "not_verified", technically_valid: true },
  );

  add(
    "sha1",
    "Signed with RSA and SHA-1, which the default policy does not permit.",
    withAtt(guide, await sign(rsaSigner, "SHA-1")),
    trusted,
    { ...ok, algorithm: "not_permitted", authority: "not_verified", technically_valid: false },
  );

  add(
    "authentication-certificate",
    "Signed with an authentication-only certificate (no nonRepudiation key usage).",
    withAtt(guide, await sign(authOnly)),
    trusted,
    { ...ok, key_usage: "not_permitted", authority: "not_verified", technically_valid: false },
  );

  write(
    "manifest.json",
    json({
      description:
        "SYNTHETIC attestation vectors for OpenSCG 0.1. The CA private keys were discarded after generation. Evaluate every case at verify_at.",
      spec_version: "0.1.0-draft",
      verify_at: "2026-11-04T00:00:00Z",
      cases,
    }),
  );
}

await main();
