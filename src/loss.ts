// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { pointerToken } from "./findings.js";

/** One piece of information that did not survive a conversion. */
export interface LossItem {
  /** JSON Pointer into the original document. */
  readonly pointer: string;
  /** `removed`: absent from the result. `changed`: present with a different value. */
  readonly kind: "removed" | "changed";
}

/**
 * What a conversion, import, export, or migration could not carry over.
 * Specification section 7.5. An empty `items` list is a claim that nothing
 * was lost, so producers must compute it rather than assume it.
 */
export interface LossReport {
  readonly complete: boolean;
  readonly items: readonly LossItem[];
  /** Human-readable explanations from the converter, if any. */
  readonly notes?: readonly string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function walk(before: unknown, after: unknown, at: string, items: LossItem[], present: boolean) {
  if (!present) {
    items.push({ pointer: at, kind: "removed" });
    return;
  }
  if (Array.isArray(before)) {
    if (!Array.isArray(after)) {
      items.push({ pointer: at, kind: "changed" });
      return;
    }
    before.forEach((v, i) => {
      walk(v, after[i], `${at}/${i}`, items, i < after.length);
    });
    return;
  }
  if (isObject(before)) {
    if (!isObject(after)) {
      items.push({ pointer: at, kind: "changed" });
      return;
    }
    for (const [k, v] of Object.entries(before)) {
      walk(v, after[k], `${at}/${pointerToken(k)}`, items, Object.hasOwn(after, k));
    }
    return;
  }
  if (!Object.is(before, after)) items.push({ pointer: at, kind: "changed" });
}

/**
 * Compare an original document with the result of rewriting it, and list every
 * value from the original that is missing or different in the result.
 *
 * Additions in `after` are not losses and are not reported. Array items are
 * compared by position.
 *
 * Example: a converter that drops `entries/2/statements/damage` reports
 * `{ pointer: "/entries/2/statements/damage", kind: "removed" }`.
 */
export function compareForLoss(before: unknown, after: unknown): LossReport {
  const items: LossItem[] = [];
  walk(before, after, "", items, true);
  return { complete: items.length === 0, items };
}
