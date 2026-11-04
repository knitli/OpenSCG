// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Detached CMS (RFC 5652) attestations over approval statements, and their
// verification (specification section 9).
//
// CMS and X.509 handling is delegated to PKI.js. Nothing here hand-builds DER.
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import { type ApprovalStatement, approvalStatementBytes, approvalText } from "./approval.js";
import { PAYLOAD_FORMAT, payloadDigest } from "./payload.js";
import type { Guide } from "./types.js";

export const ATTESTATION_FORMAT = "openscg-cms-detached-v1";

const OID = {
  data: "1.2.840.113549.1.7.1",
  signedData: "1.2.840.113549.1.7.2",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
  keyUsage: "2.5.29.15",
} as const;

/** Digest algorithms permitted by the default policy. SHA-1 is not. */
export const DEFAULT_DIGEST_ALGORITHMS: readonly string[] = [
  "2.16.840.1.101.3.4.2.1", // sha-256
  "2.16.840.1.101.3.4.2.2", // sha-384
  "2.16.840.1.101.3.4.2.3", // sha-512
];

/** Signature algorithms permitted by the default policy. */
export const DEFAULT_SIGNATURE_ALGORITHMS: readonly string[] = [
  "1.2.840.10045.4.3.2", // ecdsa-with-SHA256
  "1.2.840.10045.4.3.3", // ecdsa-with-SHA384
  "1.2.840.10045.4.3.4", // ecdsa-with-SHA512
  "1.2.840.113549.1.1.1", // rsaEncryption (with a permitted digest algorithm)
  "1.2.840.113549.1.1.10", // RSASSA-PSS
  "1.2.840.113549.1.1.11", // sha256WithRSAEncryption
  "1.2.840.113549.1.1.12", // sha384WithRSAEncryption
  "1.2.840.113549.1.1.13", // sha512WithRSAEncryption
];

export interface Attestation {
  readonly format: typeof ATTESTATION_FORMAT;
  readonly statement: ApprovalStatement;
  /** Base64 DER of a CMS ContentInfo holding a detached SignedData. */
  readonly signature: string;
}

// ---------------------------------------------------------------------------
// Encoding helpers

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text) || text.length % 4 !== 0) {
    throw new Error("Not canonical base64.");
  }
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

/** Read one or more PEM blocks of the given label (for example "CERTIFICATE"). */
export function fromPem(pem: string, label: string): Uint8Array[] {
  const re = new RegExp(`-----BEGIN ${label}-----([^-]+)-----END ${label}-----`, "g");
  return [...pem.matchAll(re)].map((m) => fromBase64((m[1] ?? "").replace(/\s+/g, "")));
}

export function toPem(der: Uint8Array, label: string): string {
  const b64 = toBase64(der)
    .replace(/(.{64})/g, "$1\n")
    .trimEnd();
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}

const buf = (u: Uint8Array): ArrayBuffer =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

function parseCert(der: Uint8Array): pkijs.Certificate {
  return pkijs.Certificate.fromBER(buf(der));
}

function parseCrl(der: Uint8Array): pkijs.CertificateRevocationList {
  return pkijs.CertificateRevocationList.fromBER(buf(der));
}

function sameBytes(a: ArrayBuffer, b: ArrayBuffer): boolean {
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

const nameBytes = (n: pkijs.RelativeDistinguishedNames) => n.toSchema().toBER(false);

function describeName(n: pkijs.RelativeDistinguishedNames): string {
  const short: Record<string, string> = {
    "2.5.4.3": "CN",
    "2.5.4.10": "O",
    "2.5.4.11": "OU",
    "2.5.4.6": "C",
  };
  return n.typesAndValues
    .map((tv) => `${short[tv.type] ?? tv.type}=${tv.value.valueBlock.value}`)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Producing an attestation

export interface CreateAttestationOptions {
  readonly statement: ApprovalStatement;
  /** A Web Crypto private key able to sign. */
  readonly privateKey: CryptoKey;
  /** DER of the signer's certificate. */
  readonly certificate: Uint8Array;
  /** DER of any intermediate certificates to include. */
  readonly chain?: readonly Uint8Array[];
  /** Hash algorithm name for Web Crypto. Default SHA-256. */
  readonly hash?: "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
  /** Signing time to record. It is a claim and verifiers do not trust it. */
  readonly signingTime?: Date;
}

/**
 * Create a detached CMS attestation over an approval statement with a key the
 * caller already holds.
 *
 * This exists for test vectors and for environments where an approved signing
 * interface exposes a Web Crypto key. It never generates, imports, or stores keys.
 */
export async function createAttestation(options: CreateAttestationOptions): Promise<Attestation> {
  const { statement, ...rest } = options;
  return {
    format: ATTESTATION_FORMAT,
    statement,
    signature: await signDetached(approvalStatementBytes(statement), rest),
  };
}

export type SignDetachedOptions = Omit<CreateAttestationOptions, "statement">;

/**
 * Produce a detached CMS signature (base64 DER ContentInfo) over exact bytes,
 * with signed attributes: content type, message digest and, optionally, a
 * claimed signing time.
 */
export async function signDetached(
  bytes: Uint8Array,
  options: SignDetachedOptions,
): Promise<string> {
  const hash = options.hash ?? "SHA-256";
  const data = bytes;
  const cert = parseCert(options.certificate);
  const messageDigest = await globalThis.crypto.subtle.digest(hash, buf(data));
  const attrs = [
    new pkijs.Attribute({
      type: OID.contentType,
      values: [new asn1js.ObjectIdentifier({ value: OID.data })],
    }),
    new pkijs.Attribute({
      type: OID.messageDigest,
      values: [new asn1js.OctetString({ valueHex: messageDigest })],
    }),
  ];
  if (options.signingTime) {
    attrs.push(
      new pkijs.Attribute({
        type: OID.signingTime,
        values: [new asn1js.UTCTime({ valueDate: options.signingTime })],
      }),
    );
  }
  const signedData = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: OID.data }),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({
          issuer: cert.issuer,
          serialNumber: cert.serialNumber,
        }),
        signedAttrs: new pkijs.SignedAndUnsignedAttributes({ type: 0, attributes: attrs }),
      }),
    ],
    certificates: [cert, ...(options.chain ?? []).map(parseCert)],
  });
  // With signed attributes present, PKI.js signs the DER of the attributes.
  // The content itself is covered through the messageDigest attribute above,
  // so the content is hashed exactly once.
  await signedData.sign(options.privateKey, 0, hash, buf(data));
  const ci = new pkijs.ContentInfo({
    contentType: OID.signedData,
    content: signedData.toSchema(true),
  });
  return toBase64(new Uint8Array(ci.toSchema().toBER(false)));
}

// ---------------------------------------------------------------------------
// Verifying an attestation

export interface TrustPolicy {
  /** DER of trust anchors. Required: there is no default trust. */
  readonly trustAnchors: readonly Uint8Array[];
  /** DER of extra intermediates, beyond those in the signature. */
  readonly intermediates?: readonly Uint8Array[];
  /** DER of CRLs, supplied offline. */
  readonly crls?: readonly Uint8Array[];
  /**
   * What to do when revocation status cannot be established.
   * `fail` (default) treats unknown as a failure. `accept` reports it but passes.
   */
  readonly unknownRevocation?: "fail" | "accept";
  /** Time at which to evaluate validity and revocation. Default: now. */
  readonly time?: Date;
  readonly digestAlgorithms?: readonly string[];
  readonly signatureAlgorithms?: readonly string[];
  /**
   * Require the nonRepudiation (contentCommitment) key usage bit, as a document
   * signing certificate normally has. Default true. When false, digitalSignature
   * is enough.
   */
  readonly requireNonRepudiation?: boolean;
}

export type CheckStatus<T extends string> = T | "not_checked";

/** Each result is reported separately (specification section 9.4). */
export interface VerificationReport {
  /** Does the statement describe exactly this guide revision? */
  readonly binding: "ok" | "mismatch";
  readonly binding_problems: readonly string[];
  readonly signature: "valid" | "invalid" | "malformed";
  readonly algorithm: CheckStatus<"permitted" | "not_permitted">;
  readonly key_usage: CheckStatus<"permitted" | "not_permitted">;
  readonly validity: CheckStatus<"ok" | "expired" | "not_yet_valid">;
  readonly trust: CheckStatus<"trusted" | "untrusted">;
  readonly revocation: CheckStatus<"good" | "revoked" | "unknown">;
  /** From the guide's human `review`, never from the signature. */
  readonly authority: "not_verified" | "review_complete" | "review_rejected";
  readonly signer_subject?: string;
  /** Signer-supplied; not trusted. */
  readonly claimed_signing_time?: string;
  /** True only if every technical check passes under the policy. */
  readonly technically_valid: boolean;
  readonly summary: string;
}

function keyUsageBits(
  cert: pkijs.Certificate,
): { digitalSignature: boolean; nonRepudiation: boolean } | undefined {
  const ext = cert.extensions?.find((e) => e.extnID === OID.keyUsage);
  if (!ext) return undefined;
  const bits = ext.parsedValue as asn1js.BitString | undefined;
  const first = bits?.valueBlock.valueHexView[0] ?? 0;
  return { digitalSignature: (first & 0x80) !== 0, nonRepudiation: (first & 0x40) !== 0 };
}

async function checkRevocation(
  path: pkijs.Certificate[],
  crls: pkijs.CertificateRevocationList[],
  time: Date,
): Promise<"good" | "revoked" | "unknown"> {
  let result: "good" | "unknown" = "good";
  // Every certificate except the trust anchor (last in path) needs a status.
  for (let i = 0; i < path.length - 1; i++) {
    const cert = path[i] as pkijs.Certificate;
    const issuer = path[i + 1] as pkijs.Certificate;
    let status: "good" | "revoked" | "unknown" = "unknown";
    for (const crl of crls) {
      if (!sameBytes(nameBytes(crl.issuer), nameBytes(cert.issuer))) continue;
      let ok = false;
      try {
        ok = await crl.verify({ issuerCertificate: issuer });
      } catch {
        ok = false;
      }
      if (!ok) continue;
      if (crl.thisUpdate.value > time) continue;
      if (crl.nextUpdate && crl.nextUpdate.value < time) continue; // stale
      const serial = cert.serialNumber.valueBlock.valueHexView;
      const revoked = crl.revokedCertificates?.some((r) =>
        sameBytes(buf(r.userCertificate.valueBlock.valueHexView), buf(serial)),
      );
      status = revoked ? "revoked" : "good";
      break;
    }
    if (status === "revoked") return "revoked";
    if (status === "unknown") result = "unknown";
  }
  return result;
}

async function checkBinding(guide: Guide, statement: ApprovalStatement): Promise<string[]> {
  const problems: string[] = [];
  const s = statement as unknown as Record<string, unknown>;
  if (s.type !== "openscg-approval-statement") problems.push("type");
  if (s.version !== 1) problems.push("version");
  if (s.purpose !== "approve-scg-revision") problems.push("purpose");
  if (s.payload_format !== PAYLOAD_FORMAT) problems.push("payload_format");
  for (const k of ["guide_id", "revision_id", "schema_version", "profile"] as const) {
    if (s[k] !== guide[k]) problems.push(k);
  }
  const digest = await payloadDigest(guide);
  const claimed = statement.payload_digest;
  if (claimed?.alg !== "sha-256" || claimed.value !== digest.value) problems.push("payload_digest");
  if (statement.statement_text !== approvalText(guide, digest)) problems.push("statement_text");
  return problems;
}

function summarize(
  r: Omit<VerificationReport, "summary" | "technically_valid">,
  policy: TrustPolicy,
) {
  const failures: string[] = [];
  if (r.binding !== "ok")
    failures.push(`statement does not match this revision (${r.binding_problems.join(", ")})`);
  if (r.signature !== "valid") failures.push(`signature ${r.signature}`);
  if (r.algorithm !== "permitted") failures.push(`algorithm ${r.algorithm}`);
  if (r.key_usage !== "permitted") failures.push(`key usage ${r.key_usage}`);
  if (r.validity !== "ok") failures.push(`certificate ${r.validity}`);
  if (r.trust !== "trusted") failures.push(`trust ${r.trust}`);
  if (r.revocation === "revoked") failures.push("certificate revoked");
  else if (r.revocation === "not_checked") failures.push("revocation not checked");
  else if (r.revocation === "unknown" && (policy.unknownRevocation ?? "fail") === "fail") {
    failures.push("revocation status unknown");
  }
  const technically_valid = failures.length === 0;
  let summary: string;
  if (!technically_valid) summary = `Not valid: ${failures.join("; ")}.`;
  else {
    const rev =
      r.revocation === "unknown"
        ? " Revocation status is unknown and was accepted by local policy."
        : "";
    summary =
      r.authority === "review_complete"
        ? `Signature valid; a human authority review is recorded as complete.${rev}`
        : r.authority === "review_rejected"
          ? `Signature valid; the recorded authority review REJECTED the signer's authority.${rev}`
          : `Signature valid; authority not verified.${rev}`;
  }
  return { technically_valid, summary };
}

/**
 * Verify an attestation against a guide revision under a trust policy.
 *
 * Fails closed: anything that cannot be parsed or checked is reported as such,
 * never as valid. A valid result says the statement is bound to this payload
 * and was signed by a trusted, unrevoked certificate. It does not say the
 * signer holds classification authority; see `authority`.
 */
export async function verifyAttestation(
  guide: Guide,
  attestation: Attestation,
  policy: TrustPolicy,
): Promise<VerificationReport> {
  const reviewStatus = guide.review?.status;
  const authority: VerificationReport["authority"] =
    reviewStatus === "complete"
      ? "review_complete"
      : reviewStatus === "rejected"
        ? "review_rejected"
        : "not_verified";

  const problems = attestation.format === ATTESTATION_FORMAT ? [] : ["format"];
  problems.push(...(await checkBinding(guide, attestation.statement)));

  const base = {
    binding: problems.length === 0 ? ("ok" as const) : ("mismatch" as const),
    binding_problems: problems,
    algorithm: "not_checked" as const,
    key_usage: "not_checked" as const,
    validity: "not_checked" as const,
    trust: "not_checked" as const,
    revocation: "not_checked" as const,
    authority,
  };
  const finish = (
    r: Omit<VerificationReport, "summary" | "technically_valid">,
  ): VerificationReport => ({
    ...r,
    ...summarize(r, policy),
  });

  let data: Uint8Array;
  try {
    data = approvalStatementBytes(attestation.statement);
  } catch {
    return finish({ ...base, signature: "malformed" });
  }
  return finish({ ...base, ...(await verifyDetached(data, attestation.signature, policy)) });
}

/** The cryptographic and PKI results for one detached CMS signature. */
export type DetachedResult = Pick<
  VerificationReport,
  | "signature"
  | "algorithm"
  | "key_usage"
  | "validity"
  | "trust"
  | "revocation"
  | "signer_subject"
  | "claimed_signing_time"
>;

const NOT_CHECKED = {
  algorithm: "not_checked",
  key_usage: "not_checked",
  validity: "not_checked",
  trust: "not_checked",
  revocation: "not_checked",
} as const;

/**
 * Verify a detached CMS signature (base64 DER ContentInfo) over exact bytes,
 * under a trust policy. Used for approval statements and release manifests.
 * Does not check what the bytes mean; callers check the binding.
 */
export async function verifyDetached(
  data: Uint8Array,
  signature: string,
  policy: TrustPolicy,
): Promise<DetachedResult> {
  const time = policy.time ?? new Date();
  let signedData: pkijs.SignedData;
  try {
    const ci = pkijs.ContentInfo.fromBER(buf(fromBase64(signature)));
    if (ci.contentType !== OID.signedData) throw new Error("not SignedData");
    signedData = new pkijs.SignedData({ schema: ci.content });
    if (signedData.signerInfos.length !== 1) throw new Error("exactly one signer required");
    if (signedData.encapContentInfo.eContent) throw new Error("content must be detached");
  } catch {
    return { ...NOT_CHECKED, signature: "malformed" };
  }

  const signerInfo = signedData.signerInfos[0] as pkijs.SignerInfo;
  if (!signerInfo.signedAttrs) return { ...NOT_CHECKED, signature: "malformed" };

  let signerCert: pkijs.Certificate | undefined;
  let signatureOk = false;
  try {
    const result = await signedData.verify({
      signer: 0,
      data: buf(data),
      extendedMode: true,
      checkChain: false,
    });
    signatureOk = result.signatureVerified === true;
    signerCert = result.signerCertificate ?? undefined;
  } catch (e) {
    const detail = e as { signerCertificate?: pkijs.Certificate };
    signerCert = detail.signerCertificate;
    signatureOk = false;
  }

  const timeAttr = signerInfo.signedAttrs.attributes.find((a) => a.type === OID.signingTime);
  const claimedTime = (timeAttr?.values[0] as asn1js.UTCTime | undefined)?.toDate().toISOString();
  const subject = signerCert ? describeName(signerCert.subject) : undefined;
  const extra = {
    ...(subject !== undefined ? { signer_subject: subject } : {}),
    ...(claimedTime !== undefined ? { claimed_signing_time: claimedTime } : {}),
  };

  if (!signerCert) return { ...NOT_CHECKED, ...extra, signature: "malformed" };

  const digestOk = (policy.digestAlgorithms ?? DEFAULT_DIGEST_ALGORITHMS).includes(
    signerInfo.digestAlgorithm.algorithmId,
  );
  const sigAlgOk = (policy.signatureAlgorithms ?? DEFAULT_SIGNATURE_ALGORITHMS).includes(
    signerInfo.signatureAlgorithm.algorithmId,
  );
  const algorithm = digestOk && sigAlgOk ? ("permitted" as const) : ("not_permitted" as const);

  const ku = keyUsageBits(signerCert);
  const needNR = policy.requireNonRepudiation ?? true;
  const key_usage =
    ku && (needNR ? ku.nonRepudiation : ku.digitalSignature || ku.nonRepudiation)
      ? ("permitted" as const)
      : ("not_permitted" as const);

  const validity =
    signerCert.notBefore.value > time
      ? ("not_yet_valid" as const)
      : signerCert.notAfter.value < time
        ? ("expired" as const)
        : ("ok" as const);

  // Path validation. When the signer certificate is outside its validity period,
  // build the path at the midpoint of its validity period, so that "untrusted" and
  // "expired" stay distinct results.
  const chainTime =
    validity === "ok"
      ? time
      : new Date((signerCert.notBefore.value.getTime() + signerCert.notAfter.value.getTime()) / 2);
  let trust: "trusted" | "untrusted" = "untrusted";
  let path: pkijs.Certificate[] = [];
  try {
    const engine = new pkijs.CertificateChainValidationEngine({
      trustedCerts: policy.trustAnchors.map(parseCert),
      certs: [
        signerCert,
        ...(signedData.certificates ?? []).filter((c) => c instanceof pkijs.Certificate),
        ...(policy.intermediates ?? []).map(parseCert),
      ],
      checkDate: chainTime,
    });
    const r = await engine.verify();
    if (r.result) {
      trust = "trusted";
      path = r.certificatePath ?? [];
    }
  } catch {
    trust = "untrusted";
  }

  const revocation =
    trust === "trusted"
      ? await checkRevocation(path, (policy.crls ?? []).map(parseCrl), time)
      : ("not_checked" as const);

  return {
    ...NOT_CHECKED,
    ...extra,
    signature: signatureOk ? "valid" : "invalid",
    algorithm,
    key_usage,
    validity,
    trust,
    revocation,
  };
}
