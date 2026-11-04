// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
//
// A throwaway, in-memory, SYNTHETIC test PKI used by the vector generator and
// the tests. Nothing here is suitable for real use.
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

const subtle = globalThis.crypto.subtle;
const EC = { name: "ECDSA", namedCurve: "P-256" } as const;
let serial = 1;

export const KU = {
  digitalSignature: 0x80,
  nonRepudiation: 0x40,
  keyCertSign: 0x04,
  cRLSign: 0x02,
};

function name(cn: string) {
  return new pkijs.RelativeDistinguishedNames({
    typesAndValues: [
      new pkijs.AttributeTypeAndValue({
        type: "2.5.4.10",
        value: new asn1js.Utf8String({ value: "SYNTHETIC OpenSCG Test PKI" }),
      }),
      new pkijs.AttributeTypeAndValue({
        type: "2.5.4.3",
        value: new asn1js.Utf8String({ value: cn }),
      }),
    ],
  });
}

export interface Issued {
  cert: pkijs.Certificate;
  der: Uint8Array;
  keys: CryptoKeyPair;
}

export async function issue(opts: {
  cn: string;
  issuer?: Issued;
  ca?: boolean;
  keyUsage: number;
  clientAuthOnly?: boolean;
  notBefore: string;
  notAfter: string;
  rsa?: boolean;
}): Promise<Issued> {
  const keys = (await subtle.generateKey(
    opts.rsa
      ? {
          name: "RSASSA-PKCS1-v1_5",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-1",
        }
      : EC,
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const cert = new pkijs.Certificate();
  cert.version = 2;
  cert.serialNumber = new asn1js.Integer({ value: serial++ });
  cert.subject = name(opts.cn);
  cert.issuer = opts.issuer ? opts.issuer.cert.subject : cert.subject;
  cert.notBefore.value = new Date(opts.notBefore);
  cert.notAfter.value = new Date(opts.notAfter);
  await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
  const exts: pkijs.Extension[] = [
    new pkijs.Extension({
      extnID: "2.5.29.19",
      critical: true,
      extnValue: new pkijs.BasicConstraints({ cA: opts.ca === true }).toSchema().toBER(false),
    }),
    new pkijs.Extension({
      extnID: "2.5.29.15",
      critical: true,
      extnValue: new asn1js.BitString({
        valueHex: new Uint8Array([opts.keyUsage]).buffer,
        unusedBits: 1,
      }).toBER(false),
    }),
  ];
  if (opts.clientAuthOnly) {
    exts.push(
      new pkijs.Extension({
        extnID: "2.5.29.37",
        extnValue: new pkijs.ExtKeyUsage({ keyPurposes: ["1.3.6.1.5.5.7.3.2"] })
          .toSchema()
          .toBER(false),
      }),
    );
  }
  cert.extensions = exts;
  const signer = opts.issuer?.keys.privateKey ?? keys.privateKey;
  await cert.sign(signer, "SHA-256");
  return { cert, keys, der: new Uint8Array(cert.toSchema(true).toBER(false)) };
}

export async function crl(
  issuer: Issued,
  revoked: Issued[],
  thisUpdate: string,
  nextUpdate: string,
) {
  const c = new pkijs.CertificateRevocationList();
  c.version = 1;
  c.issuer = issuer.cert.subject;
  c.thisUpdate = new pkijs.Time({ type: 0, value: new Date(thisUpdate) });
  c.nextUpdate = new pkijs.Time({ type: 0, value: new Date(nextUpdate) });
  c.revokedCertificates = revoked.map(
    (r) =>
      new pkijs.RevokedCertificate({
        userCertificate: r.cert.serialNumber,
        revocationDate: new pkijs.Time({ type: 0, value: new Date("2026-09-01T00:00:00Z") }),
      }),
  );
  await c.sign(issuer.keys.privateKey, "SHA-256");
  return new Uint8Array(c.toSchema(true).toBER(false));
}
