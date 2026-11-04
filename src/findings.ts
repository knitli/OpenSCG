// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * How serious a finding is. See specification section 7.2.
 *
 * - `error`: blocks approval. A draft may still be saved.
 * - `warning`: a person must review it.
 * - `unsupported`: uses something this version cannot vouch for. Blocks approval.
 * - `policy_review`: software cannot decide; a policy office must. Blocks approval
 *   until a person records the outcome outside the format.
 */
export type Severity = "error" | "warning" | "unsupported" | "policy_review";

/** One result from validation. */
export interface Finding {
  /** Stable finding code, for example `OSCG-S001`. Listed in the specification. */
  readonly code: string;
  readonly severity: Severity;
  /** RFC 6901 JSON Pointer to the field the finding is about. `""` is the whole document. */
  readonly pointer: string;
  /** Plain-language explanation. Wording may change between versions; the code does not. */
  readonly message: string;
}

/** Severities that block an approval operation. */
export const BLOCKING_SEVERITIES: ReadonlySet<Severity> = new Set([
  "error",
  "unsupported",
  "policy_review",
]);

/** True when none of the findings block approval. This is not a compliance determination. */
export function isApprovalReady(findings: readonly Finding[]): boolean {
  return !findings.some((f) => BLOCKING_SEVERITIES.has(f.severity));
}

/** Escape one JSON Pointer reference token (RFC 6901 section 4). */
export function pointerToken(token: string | number): string {
  return String(token).replaceAll("~", "~0").replaceAll("/", "~1");
}

/** Build a JSON Pointer from reference tokens. */
export function pointer(...tokens: (string | number)[]): string {
  return tokens.map((t) => `/${pointerToken(t)}`).join("");
}
