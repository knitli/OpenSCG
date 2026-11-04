// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Release manifests (specification section 10.3): a signed list of the exact
// files released for one guide revision, so that a PDF or workbook rendition
// can be checked byte-for-byte. A digest printed inside a rendition does not
// prove the rendition is faithful; a signed manifest proves which bytes were
// released.
import {
  type DetachedResult,
  type SignDetachedOptions,
  signDetached,
  type TrustPolicy,
  verifyDetached,
} from "./attestation.js";
import { canonicalize } from "./canonical.js";
import { type Digest, payloadDigest, sha256 } from "./payload.js";
import type { Guide } from "./types.js";

export const RELEASE_MANIFEST_DOMAIN = "OpenSCG-Release-Manifest-v1\n";

export type FileRole = "guide-json" | "attestation" | "rendition-pdf" | "rendition-xlsx" | "other";

export interface ManifestFile {
  readonly name: string;
  readonly media_type: string;
  readonly role: FileRole;
  readonly sha256: string;
}

export interface ReleaseManifest {
  readonly type: "openscg-release-manifest";
  readonly version: 1;
  readonly guide_id: string;
  readonly revision_id: string;
  readonly payload_digest: Digest;
  readonly files: readonly ManifestFile[];
}

export interface SignedReleaseManifest {
  readonly manifest: ReleaseManifest;
  /** Base64 DER detached CMS over `releaseManifestBytes(manifest)`. */
  readonly signature: string;
}

export interface ReleaseFile {
  readonly name: string;
  readonly media_type: string;
  readonly role: FileRole;
  readonly bytes: Uint8Array;
}

/** Build a manifest listing the SHA-256 of each released file. */
export async function buildReleaseManifest(
  guide: Guide,
  files: readonly ReleaseFile[],
): Promise<ReleaseManifest> {
  const names = new Set<string>();
  const listed: ManifestFile[] = [];
  for (const f of files) {
    if (names.has(f.name)) throw new Error(`File name "${f.name}" appears twice.`);
    names.add(f.name);
    listed.push({
      name: f.name,
      media_type: f.media_type,
      role: f.role,
      sha256: (await sha256(f.bytes)).value,
    });
  }
  return {
    type: "openscg-release-manifest",
    version: 1,
    guide_id: guide.guide_id,
    revision_id: guide.revision_id,
    payload_digest: await payloadDigest(guide),
    files: listed,
  };
}

/** The exact bytes signed for a manifest: domain prefix, then canonical manifest. */
export function releaseManifestBytes(manifest: ReleaseManifest): Uint8Array {
  const prefix = new TextEncoder().encode(RELEASE_MANIFEST_DOMAIN);
  const body = canonicalize(manifest);
  const out = new Uint8Array(prefix.length + body.length);
  out.set(prefix, 0);
  out.set(body, prefix.length);
  return out;
}

export async function signReleaseManifest(
  manifest: ReleaseManifest,
  options: SignDetachedOptions,
): Promise<SignedReleaseManifest> {
  return { manifest, signature: await signDetached(releaseManifestBytes(manifest), options) };
}

export interface ManifestVerification extends DetachedResult {
  /** Does the manifest describe this guide revision? */
  readonly binding: "ok" | "mismatch";
  readonly files: readonly { name: string; status: "ok" | "mismatch" | "missing" }[];
  readonly technically_valid: boolean;
}

/**
 * Verify a signed manifest and the files a consumer actually holds.
 * Files listed but not supplied are reported `missing`, not assumed fine.
 */
export async function verifyReleaseManifest(
  guide: Guide,
  signed: SignedReleaseManifest,
  files: ReadonlyMap<string, Uint8Array>,
  policy: TrustPolicy,
): Promise<ManifestVerification> {
  const m = signed.manifest;
  const digest = await payloadDigest(guide);
  const binding =
    m.type === "openscg-release-manifest" &&
    m.version === 1 &&
    m.guide_id === guide.guide_id &&
    m.revision_id === guide.revision_id &&
    m.payload_digest?.value === digest.value
      ? ("ok" as const)
      : ("mismatch" as const);
  let crypto: DetachedResult;
  try {
    crypto = await verifyDetached(releaseManifestBytes(m), signed.signature, policy);
  } catch {
    crypto = {
      signature: "malformed",
      algorithm: "not_checked",
      key_usage: "not_checked",
      validity: "not_checked",
      trust: "not_checked",
      revocation: "not_checked",
    };
  }
  const results = [];
  for (const f of m.files) {
    const held = files.get(f.name);
    if (!held) results.push({ name: f.name, status: "missing" as const });
    else
      results.push({
        name: f.name,
        status: (await sha256(held)).value === f.sha256 ? ("ok" as const) : ("mismatch" as const),
      });
  }
  const revocationOk =
    crypto.revocation === "good" ||
    (crypto.revocation === "unknown" && policy.unknownRevocation === "accept");
  const technically_valid =
    binding === "ok" &&
    crypto.signature === "valid" &&
    crypto.algorithm === "permitted" &&
    crypto.key_usage === "permitted" &&
    crypto.validity === "ok" &&
    crypto.trust === "trusted" &&
    revocationOk &&
    results.every((r) => r.status === "ok");
  return { ...crypto, binding, files: results, technically_valid };
}
