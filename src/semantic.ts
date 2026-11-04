// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { type Finding, pointer, type Severity } from "./findings.js";
import { validateStructure } from "./structure.js";
import {
  type Entry,
  entryMaxLevel,
  type Guide,
  isClassified,
  LEVEL_ORDER,
  type Level,
} from "./types.js";

/** Schema versions this implementation can read. */
export const SUPPORTED_SCHEMA_VERSIONS: ReadonlySet<string> = new Set(["0.1.0"]);

/** Profiles this implementation knows. */
export const KNOWN_PROFILES: ReadonlySet<string> = new Set(["cnsi-core", "dod-5200.45"]);

export interface ValidateOptions {
  /**
   * Extension namespaces the caller understands. Any extension with
   * `must_understand: true` outside this list is reported as unsupported.
   */
  readonly supportedExtensions?: Iterable<string>;
}

/**
 * Every semantic finding code, with its fixed severity. The specification
 * (section 7.3) is the normative list; this table must match it.
 */
export const RULES = {
  "OSCG-V001": { severity: "error", summary: "Duplicate entry_id" },
  "OSCG-V002": { severity: "error", summary: "Duplicate section_id" },
  "OSCG-V003": { severity: "error", summary: "Reference to an entry that does not exist" },
  "OSCG-V004": { severity: "error", summary: "Entry names a section that does not exist" },
  "OSCG-V005": { severity: "error", summary: "Entry references itself" },
  "OSCG-V010": { severity: "error", summary: "Classified entry has no reason" },
  "OSCG-V011": { severity: "error", summary: "Guide has no entries" },
  "OSCG-V013": {
    severity: "error",
    summary: "Classified entry has no declassification instruction",
  },
  "OSCG-V014": { severity: "error", summary: "Level range is inverted" },
  "OSCG-V015": { severity: "warning", summary: "Level range has equal ends" },
  "OSCG-V016": { severity: "error", summary: "Compilation has no condition_text" },
  "OSCG-V017": { severity: "warning", summary: "Compilation references fewer than two entries" },
  "OSCG-V018": { severity: "warning", summary: "Compilation is not above its constituents" },
  "OSCG-V019": {
    severity: "warning",
    summary: "Unclassified entry carries classified-only fields",
  },
  "OSCG-V020": { severity: "policy_review", summary: "Exemption code without authority evidence" },
  "OSCG-V021": { severity: "policy_review", summary: "Exemption code with special conditions" },
  "OSCG-V022": {
    severity: "warning",
    summary: "Exemption has both an until date and an until event",
  },
  "OSCG-V023": {
    severity: "warning",
    summary: "Declassification date is not after the issue date",
  },
  "OSCG-V030": {
    severity: "unsupported",
    summary: "Atomic Energy Act information is not supported",
  },
  "OSCG-V031": { severity: "unsupported", summary: "Unknown profile" },
  "OSCG-V032": { severity: "warning", summary: "Profile is unverified" },
  "OSCG-V033": { severity: "unsupported", summary: "Unsupported must-understand extension" },
  "OSCG-V034": {
    severity: "warning",
    summary: "Unrecognized extension preserved but not interpreted",
  },
  "OSCG-V035": { severity: "unsupported", summary: "Unsupported schema_version" },
  "OSCG-V040": { severity: "error", summary: "Guide has no subject" },
  "OSCG-V041": { severity: "error", summary: "Guide has no OCA" },
  "OSCG-V042": { severity: "error", summary: "Guide has no point of contact" },
  "OSCG-V043": { severity: "error", summary: "Guide has no issue or last-review date" },
  "OSCG-V044": { severity: "error", summary: "Document has no banner marking" },
  "OSCG-V045": {
    severity: "error",
    summary: "Classified document has no classification authority block",
  },
  "OSCG-V046": { severity: "policy_review", summary: "Document markings not reviewed" },
  "OSCG-V049": {
    severity: "error",
    summary: "Claimed OCA level is below the guide's highest level",
  },
  "OSCG-V050": {
    severity: "error",
    summary: "Claimed delegation is below the guide's highest level",
  },
  "OSCG-V052": { severity: "warning", summary: "Classified guidance but no claimed OCA level" },
} as const satisfies Record<string, { severity: Severity; summary: string }>;

export type RuleCode = keyof typeof RULES;

/** Exemption codes that ISOO Notice 2025-01 treats specially. */
const SPECIAL_EXEMPTIONS = new Set(["50X1-HUM", "50X2-WMD"]);

class Collector {
  readonly findings: Finding[] = [];
  add(code: RuleCode, at: string, message: string) {
    this.findings.push({ code, severity: RULES[code].severity, pointer: at, message });
  }
}

function checkExtensions(
  out: Collector,
  extensions: Guide["extensions"],
  base: (string | number)[],
  supported: ReadonlySet<string>,
) {
  for (const [ns, ext] of Object.entries(extensions ?? {})) {
    if (supported.has(ns)) continue;
    const at = pointer(...base, "extensions", ns);
    if (ext.must_understand) {
      out.add(
        "OSCG-V033",
        at,
        `Extension "${ns}" is marked must_understand and this implementation does not support it. The guide cannot be approved here.`,
      );
    } else {
      out.add("OSCG-V034", at, `Extension "${ns}" is kept exactly as is but not interpreted.`);
    }
  }
}

function checkEntry(
  out: Collector,
  entry: Entry,
  i: number,
  ids: ReadonlySet<string>,
  sectionIds: ReadonlySet<string> | undefined,
  byId: ReadonlyMap<string, Entry>,
  issued: string | undefined,
  supported: ReadonlySet<string>,
) {
  const at = (...t: (string | number)[]) => pointer("entries", i, ...t);

  if (entry.section_id !== undefined && !sectionIds?.has(entry.section_id)) {
    out.add(
      "OSCG-V004",
      at("section_id"),
      `Section "${entry.section_id}" is not defined in "sections".`,
    );
  }

  (entry.references ?? []).forEach((ref, j) => {
    if (ref === entry.entry_id) {
      out.add("OSCG-V005", at("references", j), "An entry cannot reference itself.");
    } else if (!ids.has(ref)) {
      out.add("OSCG-V003", at("references", j), `No entry has entry_id "${ref}".`);
    }
  });

  if (entry.regime === "aea") {
    out.add(
      "OSCG-V030",
      at("regime"),
      "Atomic Energy Act information (RD, FRD, TFNI) follows different rules. OpenSCG 0.1 cannot vouch for it, so this guide cannot be approved as supported guidance.",
    );
  }

  const range = entry.level_range;
  if (range) {
    if (LEVEL_ORDER[range.lowest] > LEVEL_ORDER[range.highest]) {
      out.add(
        "OSCG-V014",
        at("level_range"),
        `"lowest" (${range.lowest}) is above "highest" (${range.highest}).`,
      );
    } else if (range.lowest === range.highest) {
      out.add(
        "OSCG-V015",
        at("level_range"),
        `Both ends are ${range.lowest}. Use "level" instead of a range.`,
      );
    }
  }

  const classified = isClassified(entry);
  if (classified && entry.regime !== "aea") {
    if (!entry.reason) {
      out.add(
        "OSCG-V010",
        at("reason"),
        "A classified entry needs a concise reason citing at least one E.O. 13526 section 1.4 category.",
      );
    }
    if (!entry.declassification) {
      out.add(
        "OSCG-V013",
        at("declassification"),
        "A classified entry needs a declassification instruction.",
      );
    }
  }
  if (!classified && (entry.reason || entry.declassification)) {
    out.add(
      "OSCG-V019",
      at(entry.reason ? "reason" : "declassification"),
      "This entry is unclassified but has a classification reason or declassification instruction. Check that this is intended.",
    );
  }

  const d = entry.declassification;
  if (d?.kind === "exemption") {
    if (!d.authority) {
      out.add(
        "OSCG-V020",
        at("declassification", "authority"),
        `Exemption ${d.code} has no authority evidence. Choosing a code does not show the exemption was approved; a policy office must confirm it.`,
      );
    }
    if (d.code && SPECIAL_EXEMPTIONS.has(d.code)) {
      out.add(
        "OSCG-V021",
        at("declassification", "code"),
        `${d.code} has its own conditions under ISOO Notice 2025-01. A policy office must confirm how it applies.`,
      );
    }
    if (d.until_date && d.until_event_text) {
      out.add(
        "OSCG-V022",
        at("declassification"),
        "Give an until date or an until event, not both.",
      );
    }
  }
  if (d?.kind === "date" && d.date && issued && d.date <= issued) {
    out.add(
      "OSCG-V023",
      at("declassification", "date"),
      `Declassification date ${d.date} is not after the issue date ${issued}.`,
    );
  }

  if (entry.kind === "compilation") {
    if (!entry.condition_text) {
      out.add(
        "OSCG-V016",
        at("condition_text"),
        "A compilation must say, in words, when the combination applies.",
      );
    }
    const refs = entry.references ?? [];
    if (refs.length < 2) {
      out.add(
        "OSCG-V017",
        at("references"),
        "A compilation usually names at least two constituent entries.",
      );
    }
    const max = entryMaxLevel(entry);
    const constituents = refs.map((r) => byId.get(r)).filter((e): e is Entry => e !== undefined);
    if (max && constituents.length > 0) {
      const top = Math.max(...constituents.map((e) => LEVEL_ORDER[entryMaxLevel(e) ?? "U"]));
      if (LEVEL_ORDER[max] <= top) {
        out.add(
          "OSCG-V018",
          at(entry.level ? "level" : "level_range"),
          "The compilation's level is not higher than every constituent's. Check whether it adds protection.",
        );
      }
    }
  }

  checkExtensions(out, entry.extensions, ["entries", i], supported);
}

/**
 * Run the semantic rules in specification section 7 on a document that has
 * already passed structural validation.
 */
export function validateSemantics(guide: Guide, options: ValidateOptions = {}): Finding[] {
  const out = new Collector();
  const supported = new Set(options.supportedExtensions ?? []);

  if (!KNOWN_PROFILES.has(guide.profile)) {
    out.add(
      "OSCG-V031",
      "/profile",
      `Profile "${guide.profile}" is not known to this implementation.`,
    );
  } else if (guide.profile === "dod-5200.45") {
    out.add(
      "OSCG-V032",
      "/profile",
      "The dod-5200.45 profile has not been reviewed by a DoD subject-matter expert. It applies only the core rules and does not establish DoDM 5200.45 or DTIC conformance.",
    );
  }

  // Identifiers
  const sectionIds = guide.sections ? new Set<string>() : undefined;
  guide.sections?.forEach((s, i) => {
    if (sectionIds?.has(s.section_id)) {
      out.add(
        "OSCG-V002",
        pointer("sections", i, "section_id"),
        `section_id "${s.section_id}" is used more than once.`,
      );
    }
    sectionIds?.add(s.section_id);
  });
  const ids = new Set<string>();
  const byId = new Map<string, Entry>();
  guide.entries.forEach((e, i) => {
    if (ids.has(e.entry_id)) {
      out.add(
        "OSCG-V001",
        pointer("entries", i, "entry_id"),
        `entry_id "${e.entry_id}" is used more than once.`,
      );
    } else {
      byId.set(e.entry_id, e);
    }
    ids.add(e.entry_id);
  });

  if (guide.entries.length === 0) {
    out.add(
      "OSCG-V011",
      "/entries",
      "The guide has no entries, so no information element is mapped to a level.",
    );
  }

  const issued = guide.dates?.issued;
  guide.entries.forEach((e, i) => {
    checkEntry(out, e, i, ids, sectionIds, byId, issued, supported);
  });

  // Guide-level content (32 CFR 2001.15(b))
  if (!guide.subject) out.add("OSCG-V040", "/subject", "Identify the subject matter of the guide.");
  if (!guide.oca) {
    out.add(
      "OSCG-V041",
      "/oca",
      "Identify the OCA by name and position, or by personal identifier.",
    );
  }
  if (!guide.point_of_contact) {
    out.add("OSCG-V042", "/point_of_contact", "Identify an agency point of contact for questions.");
  }
  if (!guide.dates?.issued && !guide.dates?.last_reviewed) {
    out.add("OSCG-V043", "/dates", "Give the date of issuance or of last review.");
  }

  const dm = guide.document_markings;
  if (!dm.banner) {
    out.add(
      "OSCG-V044",
      "/document_markings/banner",
      "Give the guide document's own banner marking.",
    );
  }
  if (dm.classification !== "U" && !dm.classification_authority_block) {
    out.add(
      "OSCG-V045",
      "/document_markings/classification_authority_block",
      "A classified guide document needs its own classification authority block.",
    );
  }
  if (dm.review?.status !== "complete") {
    out.add(
      "OSCG-V046",
      "/document_markings/review",
      "An authorized person must review the guide's own markings. Software does not decide them.",
    );
  }

  // Authority claims vs. the guide's highest level (E.O. 13526 section 2.2(b))
  const levels = guide.entries.map(entryMaxLevel).filter((l): l is Level => l !== undefined);
  const highest = levels.reduce<Level>((a, b) => (LEVEL_ORDER[b] > LEVEL_ORDER[a] ? b : a), "U");
  if (highest !== "U") {
    const ocaLevel = guide.oca?.highest_level;
    if (ocaLevel === undefined) {
      if (guide.oca) {
        out.add(
          "OSCG-V052",
          "/oca/highest_level",
          `The guide prescribes up to ${highest}; record the OCA's claimed level.`,
        );
      }
    } else if (LEVEL_ORDER[ocaLevel] < LEVEL_ORDER[highest]) {
      out.add(
        "OSCG-V049",
        "/oca/highest_level",
        `The guide prescribes up to ${highest}, but the OCA's claimed level is ${ocaLevel}. The approving official needs authority at the highest level the guide prescribes.`,
      );
    }
    const delegated = guide.authority?.claimed_delegation?.highest_level;
    if (delegated !== undefined && LEVEL_ORDER[delegated] < LEVEL_ORDER[highest]) {
      out.add(
        "OSCG-V050",
        "/authority/claimed_delegation/highest_level",
        `The guide prescribes up to ${highest}, but the claimed delegation is only ${delegated}.`,
      );
    }
  }

  checkExtensions(out, guide.extensions, [], supported);
  return out.findings;
}

/**
 * Validate a parsed document: structural checks first, then semantic checks.
 *
 * Returns every finding. Use `isApprovalReady()` to see whether any of them
 * block approval. An empty result means "no problems this software can
 * detect", not "compliant".
 */
export function validate(document: unknown, options: ValidateOptions = {}): Finding[] {
  // Specification section 3.1: never guess how to read an unknown version.
  if (typeof document === "object" && document !== null && !Array.isArray(document)) {
    const version = (document as { schema_version?: unknown }).schema_version;
    if (typeof version === "string" && !SUPPORTED_SCHEMA_VERSIONS.has(version)) {
      return [
        {
          code: "OSCG-V035",
          severity: RULES["OSCG-V035"].severity,
          pointer: "/schema_version",
          message: `This implementation does not support schema_version "${version}". It has not tried to interpret the file.`,
        },
      ];
    }
  }
  const structural = validateStructure(document);
  if (structural.length > 0) return structural;
  return validateSemantics(document as Guide, options);
}
