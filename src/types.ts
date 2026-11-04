// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Loose TypeScript views of an OpenSCG 0.1 document. Validation works on
// `unknown`; these types only help the semantic checks read fields safely.

export type Level = "U" | "C" | "S" | "TS";

export const LEVEL_ORDER: Readonly<Record<Level, number>> = { U: 0, C: 1, S: 2, TS: 3 };

export interface Declassification {
  kind: "date" | "event" | "relative_to_record_creation" | "exemption";
  date?: string;
  event_text?: string;
  years?: number;
  code?: string;
  until_date?: string;
  until_event_text?: string;
  authority?: { reference: string };
}

export interface Extension {
  must_understand: boolean;
  version?: string;
  data: unknown;
}

export interface Entry {
  entry_id: string;
  kind: "element" | "compilation";
  section_id?: string;
  regime?: "cnsi" | "aea";
  description: string;
  level?: Level;
  level_range?: { lowest: Level; highest: Level; condition_text: string };
  condition_text?: string;
  references?: string[];
  reason?: { categories: string[]; explanation: string };
  declassification?: Declassification;
  extensions?: Record<string, Extension>;
}

export interface Guide {
  schema_version: string;
  profile: string;
  synthetic?: boolean;
  guide_id: string;
  revision_id: string;
  title: string;
  subject?: string;
  scope?: string;
  issuing_organization?: { name: string };
  point_of_contact?: object;
  oca?: { name?: string; position?: string; personal_identifier?: string; highest_level?: Level };
  dates?: { issued?: string; last_reviewed?: string; effective?: string };
  lifecycle: { state: string };
  document_markings: {
    classification: Level;
    banner?: string;
    classification_authority_block?: object;
    review?: { status: string };
  };
  sections?: { section_id: string; title: string }[];
  entries: Entry[];
  authority?: { claimed_delegation?: { highest_level: Level } };
  extensions?: Record<string, Extension>;
  review?: { status: string };
  attestations?: unknown[];
}

/** The highest level an entry can prescribe. */
export function entryMaxLevel(entry: Entry): Level | undefined {
  return entry.level ?? entry.level_range?.highest;
}

export function isClassified(entry: Entry): boolean {
  const max = entryMaxLevel(entry);
  return max !== undefined && max !== "U";
}
