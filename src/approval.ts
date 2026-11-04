// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { canonicalize } from "./canonical.js";
import { type Digest, PAYLOAD_FORMAT, payloadDigest } from "./payload.js";
import type { Guide } from "./types.js";

/**
 * Prefix placed before the canonical approval statement (section 9.2). It keeps
 * a signature over an OpenSCG approval from being valid for any other purpose,
 * and vice versa.
 */
export const APPROVAL_DOMAIN = "OpenSCG-Approval-Statement-v1\n";

export const APPROVAL_PURPOSE = "approve-scg-revision";

export interface SignerContext {
  readonly name?: string;
  readonly position?: string;
  readonly personal_identifier?: string;
}

/** The object a signer approves (specification section 9.1). */
export interface ApprovalStatement {
  readonly type: "openscg-approval-statement";
  readonly version: 1;
  readonly purpose: typeof APPROVAL_PURPOSE;
  readonly guide_id: string;
  readonly revision_id: string;
  readonly schema_version: string;
  readonly profile: string;
  readonly payload_format: typeof PAYLOAD_FORMAT;
  readonly payload_digest: Digest;
  readonly signer: SignerContext;
  /** Human-readable text shown to the signer before signing. */
  readonly statement_text: string;
}

/** The fixed human-readable approval text (section 9.1). */
export function approvalText(
  guide: Pick<Guide, "guide_id" | "revision_id" | "title">,
  digest: Digest,
) {
  return (
    `I approve revision ${guide.revision_id} of the security classification guide ` +
    `"${guide.title}" (${guide.guide_id}), whose OpenSCG payload has SHA-256 digest ` +
    `${digest.value}. This approval covers exactly that content.`
  );
}

/**
 * Build the approval statement for a guide revision. The signer context comes
 * from `authority.claimed_signer` unless one is given.
 */
export async function buildApprovalStatement(
  guide: Guide & { authority?: { claimed_signer?: SignerContext } },
  signer?: SignerContext,
): Promise<ApprovalStatement> {
  const digest = await payloadDigest(guide);
  const ctx = signer ?? guide.authority?.claimed_signer;
  if (!ctx) throw new Error("No signer context: pass one or set authority.claimed_signer.");
  return {
    type: "openscg-approval-statement",
    version: 1,
    purpose: APPROVAL_PURPOSE,
    guide_id: guide.guide_id,
    revision_id: guide.revision_id,
    schema_version: guide.schema_version,
    profile: guide.profile,
    payload_format: PAYLOAD_FORMAT,
    payload_digest: digest,
    signer: { ...ctx },
    statement_text: approvalText(guide, digest),
  };
}

/** The exact bytes that are signed: the domain prefix, then the canonical statement. */
export function approvalStatementBytes(statement: ApprovalStatement): Uint8Array {
  const prefix = new TextEncoder().encode(APPROVAL_DOMAIN);
  const body = canonicalize(statement);
  const out = new Uint8Array(prefix.length + body.length);
  out.set(prefix, 0);
  out.set(body, prefix.length);
  return out;
}
