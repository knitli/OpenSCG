// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Migrations between OpenSCG data versions (specification compatibility
// rules, spec/compatibility.md section 5).
//
// A migration never invents guidance or markings, never rewrites a signed
// revision in place, and always reports what it could not carry over.
import { compareForLoss, type LossReport } from "./loss.js";

/** Extension namespace that holds data a migration could not map. */
export const MIGRATION_NAMESPACE = "org.openscg.migration";

export interface MigrationResult {
  /** The migrated document. It is a new draft and may still fail validation. */
  readonly document: Record<string, unknown>;
  /** What the migration did not preserve in place. */
  readonly loss: LossReport;
  /** Plain-language notes, including anything a person must now supply. */
  readonly notes: readonly string[];
}

export interface Migration {
  readonly id: string;
  readonly description: string;
  /** True when this migration knows how to read the document. */
  appliesTo(document: unknown): boolean;
  migrate(document: unknown): MigrationResult;
}

const ENTRY_FIELDS = new Set([
  "entry_id",
  "kind",
  "section_id",
  "portion_marking",
  "regime",
  "description",
  "level",
  "level_range",
  "condition_text",
  "exceptions_text",
  "references",
  "controls",
  "reason",
  "declassification",
  "sources",
  "statements",
  "notes",
  "extensions",
]);
const GUIDE_FIELDS = new Set([
  "schema_version",
  "profile",
  "synthetic",
  "guide_id",
  "revision_id",
  "title",
  "subject",
  "scope",
  "issuing_organization",
  "point_of_contact",
  "oca",
  "dates",
  "lifecycle",
  "document_markings",
  "introduction",
  "sections",
  "entries",
  "authority",
  "history",
  "extensions",
  "review",
  "attestations",
]);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reads the illustrative excerpt in the project requirements (profile
 * "cnsidraft"), which predates the published schema, and produces an
 * OpenSCG 0.1 draft.
 *
 * What it does, concretely:
 * - `profile: "cnsidraft"` becomes `"cnsi-core"`.
 * - Each entry gets a `kind`: `compilation` when it has `condition_text` and at
 *   least two `references`, otherwise `element`.
 * - `lifecycle` becomes `{ "state": "draft" }` if absent. It is a new draft.
 * - `synthetic: true` is added only if the title says SYNTHETIC.
 * - Members 0.1 does not define are moved, unchanged, into the
 *   `org.openscg.migration` extension with `must_understand: true`, so they
 *   block approval until a person decides what they mean.
 * - `document_markings` is **not** invented. If absent, the result fails
 *   structural validation until an authorized person supplies it.
 */
export const fromRequirementsIllustration: Migration = {
  id: "requirements-illustration-to-0.1",
  description: "Illustrative pre-schema excerpt (profile cnsidraft) to OpenSCG 0.1.0",
  appliesTo(document) {
    return isObject(document) && document.profile === "cnsidraft";
  },
  migrate(document) {
    if (!this.appliesTo(document)) throw new Error("Not an illustrative cnsidraft document.");
    const src = structuredClone(document) as Record<string, unknown>;
    const notes: string[] = [];
    const parked: Record<string, unknown> = {};
    const out: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(src)) {
      if (k === "entries") continue;
      if (GUIDE_FIELDS.has(k)) out[k] = v;
      else parked[`/${k}`] = v;
    }
    out.schema_version = "0.1.0";
    out.profile = "cnsi-core";
    notes.push('profile "cnsidraft" was mapped to "cnsi-core".');
    if (!("lifecycle" in out)) out.lifecycle = { state: "draft" };
    if (typeof out.title === "string" && /SYNTHETIC/i.test(out.title) && !("synthetic" in out)) {
      out.synthetic = true;
    }

    const entries = Array.isArray(src.entries) ? src.entries : [];
    out.entries = entries.map((raw, i) => {
      const e = isObject(raw) ? raw : {};
      const entry: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(e)) {
        if (ENTRY_FIELDS.has(k)) entry[k] = v;
        else parked[`/entries/${i}/${k}`] = v;
      }
      if (!("kind" in entry)) {
        const refs = Array.isArray(entry.references) ? entry.references : [];
        entry.kind = "condition_text" in entry && refs.length >= 2 ? "compilation" : "element";
      }
      return entry;
    });

    if (!("document_markings" in out)) {
      notes.push(
        "document_markings is missing. An authorized person must supply the guide's own classification and banner; the migration does not infer them.",
      );
    }
    if (Object.keys(parked).length > 0) {
      const ext = isObject(out.extensions) ? { ...out.extensions } : {};
      ext[MIGRATION_NAMESPACE] = { must_understand: true, data: { unmapped: parked } };
      out.extensions = ext;
      notes.push(
        `${Object.keys(parked).length} member(s) had no 0.1 meaning and were kept in the "${MIGRATION_NAMESPACE}" extension, which blocks approval until resolved.`,
      );
    }
    return { document: out, loss: compareForLoss(src, out), notes };
  },
};

export const MIGRATIONS: readonly Migration[] = [fromRequirementsIllustration];
