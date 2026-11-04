// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { canonicalize } from "./canonical.js";

/** Identifies the payload rules in specification section 8.4. */
export const PAYLOAD_FORMAT = "openscg-payload-v1";

/**
 * Top-level members excluded from the signed payload. They are recorded after
 * signing, and the payload must never contain its own signature or digest.
 */
export const PAYLOAD_EXCLUDED_MEMBERS: readonly string[] = ["attestations", "review"];

export interface Digest {
  readonly alg: "sha-256";
  /** Lowercase hexadecimal. */
  readonly value: string;
}

/** The guide with the excluded members removed. Does not modify its input. */
export function payloadOf(guide: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(guide)) {
    if (!PAYLOAD_EXCLUDED_MEMBERS.includes(k)) out[k] = v;
  }
  return out;
}

/** The canonical payload bytes: RFC 8785 over the payload, UTF-8. */
export function payloadBytes(guide: object): Uint8Array {
  return canonicalize(payloadOf(guide));
}

/** Lowercase hex encoding. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 of some bytes, using the platform's Web Crypto implementation. */
export async function sha256(bytes: Uint8Array): Promise<Digest> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return { alg: "sha-256", value: toHex(new Uint8Array(hash)) };
}

/** The payload digest of a guide (specification section 8.5). */
export async function payloadDigest(guide: object): Promise<Digest> {
  return sha256(payloadBytes(guide));
}
