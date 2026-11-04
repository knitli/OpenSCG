// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * OpenSCG reference library.
 *
 * OpenSCG is a proposed open interchange format for security classification
 * guides. It is not an official government standard, and nothing in this
 * library grants classification authority or makes a classification decision.
 */

/** The OpenSCG specification version this library implements. */
export const SPEC_VERSION = "0.1.0-draft";

export {
  APPROVAL_DOMAIN,
  APPROVAL_PURPOSE,
  type ApprovalStatement,
  approvalStatementBytes,
  approvalText,
  buildApprovalStatement,
  type SignerContext,
} from "./approval.js";
export {
  ATTESTATION_FORMAT,
  type Attestation,
  type CreateAttestationOptions,
  createAttestation,
  DEFAULT_DIGEST_ALGORITHMS,
  DEFAULT_SIGNATURE_ALGORITHMS,
  type DetachedResult,
  fromBase64,
  fromPem,
  type SignDetachedOptions,
  signDetached,
  type TrustPolicy,
  toBase64,
  toPem,
  type VerificationReport,
  verifyAttestation,
  verifyDetached,
} from "./attestation.js";
export {
  CanonicalizationError,
  canonicalize,
  canonicalizeToString,
  DEFAULT_LIMITS,
  type ParseLimits,
  parseStrict,
  StrictParseError,
} from "./canonical.js";
export {
  BLOCKING_SEVERITIES,
  type Finding,
  isApprovalReady,
  pointer,
  pointerToken,
  type Severity,
} from "./findings.js";
export { GUIDE_SCHEMA_0_1 } from "./generated/schema.js";
export { compareForLoss, type LossItem, type LossReport } from "./loss.js";
export {
  buildReleaseManifest,
  type FileRole,
  type ManifestFile,
  type ManifestVerification,
  RELEASE_MANIFEST_DOMAIN,
  type ReleaseFile,
  type ReleaseManifest,
  releaseManifestBytes,
  type SignedReleaseManifest,
  signReleaseManifest,
  verifyReleaseManifest,
} from "./manifest.js";
export {
  type Digest,
  PAYLOAD_EXCLUDED_MEMBERS,
  PAYLOAD_FORMAT,
  payloadBytes,
  payloadDigest,
  payloadOf,
  sha256,
  toHex,
} from "./payload.js";
export {
  KNOWN_PROFILES,
  RULES,
  type RuleCode,
  type ValidateOptions,
  validate,
  validateSemantics,
} from "./semantic.js";
export { GUIDE_SCHEMA_ID, STRUCTURE_CODE, validateStructure } from "./structure.js";
export type { Entry, Guide, Level } from "./types.js";
