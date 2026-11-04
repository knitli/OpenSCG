// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Runs the reference library against conformance/manifest.json, following
// spec/conformance.md.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isApprovalReady,
  parseStrict,
  StrictParseError,
  validate,
  validateStructure,
} from "../src/index.js";

const root = new URL("../conformance/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"));
// biome-ignore lint/suspicious/noExplicitAny: manifest entries are untyped JSON
type Case = any;

describe("conformance suite", () => {
  it.each<[string, Case]>(manifest.cases.map((c: Case) => [c.id, c]))("%s", (_id, c) => {
    const bytes = new Uint8Array(readFileSync(new URL(c.file, root)));
    if (c.expected.parse_error) {
      expect(() => parseStrict(bytes)).toThrow(StrictParseError);
      try {
        parseStrict(bytes);
      } catch (e) {
        expect((e as StrictParseError).code).toBe(c.expected.parse_error);
      }
      return;
    }
    const doc = parseStrict(bytes);
    const structural = validateStructure(doc);
    expect(structural.length === 0 ? "valid" : "invalid").toBe(c.expected.structure);
    const findings = validate(doc);
    expect(isApprovalReady(findings)).toBe(c.expected.approval_ready);
    if (c.expected.findings) {
      const got = findings
        .map((f) => ({ code: f.code, pointer: f.pointer }))
        .sort((a, b) => (a.code + a.pointer).localeCompare(b.code + b.pointer));
      expect(got).toEqual(c.expected.findings);
    }
  });

  it("covers every ISOO FY2025 failure pattern", () => {
    const ids = manifest.cases.map((c: Case) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "fy2025-no-elements",
        "fy2025-no-declassification",
        "fy2025-no-reason",
      ]),
    );
  });
});
