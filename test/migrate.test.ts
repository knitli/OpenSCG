// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  fromRequirementsIllustration,
  MIGRATION_NAMESPACE,
  parseStrict,
  validate,
} from "../src/index.js";

const source = () =>
  parseStrict(
    readFileSync(
      new URL("../conformance/migration/requirements-illustration.json", import.meta.url),
    ),
  );

describe("migration from the requirements illustration", () => {
  it("maps the profile, infers kinds, and reports the profile change", () => {
    const r = fromRequirementsIllustration.migrate(source());
    const d = r.document as { profile: string; entries: { kind: string }[]; synthetic: boolean };
    expect(d.profile).toBe("cnsi-core");
    expect(d.entries.map((e) => e.kind)).toEqual(["element", "element", "compilation"]);
    expect(d.synthetic).toBe(true);
    expect(r.loss.items).toEqual([{ pointer: "/profile", kind: "changed" }]);
  });

  it("does not invent document markings, so the result is not yet valid", () => {
    const r = fromRequirementsIllustration.migrate(source());
    expect(r.document.document_markings).toBeUndefined();
    expect(r.notes.join(" ")).toMatch(/document_markings is missing/);
    expect(validate(r.document)).toContainEqual(
      expect.objectContaining({ code: "OSCG-S000", pointer: "/document_markings" }),
    );
  });

  it("validates once a person supplies the markings", () => {
    const r = fromRequirementsIllustration.migrate(source());
    const d = {
      ...r.document,
      document_markings: { classification: "U", banner: "UNCLASSIFIED — SYNTHETIC EXAMPLE" },
    };
    const entryFindings = validate(d).filter((f) => f.pointer.startsWith("/entries"));
    expect(entryFindings).toEqual([]);
  });

  it("keeps unknown members in a must-understand extension and reports them", () => {
    const src = source() as Record<string, unknown> & { entries: Record<string, unknown>[] };
    src.color = "blue";
    (src.entries[0] as Record<string, unknown>).weight = 3;
    const r = fromRequirementsIllustration.migrate(src);
    const ext = (
      r.document.extensions as Record<
        string,
        { must_understand: boolean; data: { unmapped: object } }
      >
    )[MIGRATION_NAMESPACE];
    expect(ext?.must_understand).toBe(true);
    expect(ext?.data.unmapped).toEqual({ "/color": "blue", "/entries/0/weight": 3 });
    expect(r.loss.items).toEqual(
      expect.arrayContaining([
        { pointer: "/color", kind: "removed" },
        { pointer: "/entries/0/weight", kind: "removed" },
      ]),
    );
    const d = { ...r.document, document_markings: { classification: "U", banner: "U" } };
    expect(validate(d).map((f) => f.code)).toContain("OSCG-V033");
  });

  it("does not modify its input", () => {
    const src = source();
    const copy = structuredClone(src);
    fromRequirementsIllustration.migrate(src);
    expect(src).toEqual(copy);
  });

  it("refuses documents it does not recognize", () => {
    expect(fromRequirementsIllustration.appliesTo({ profile: "cnsi-core" })).toBe(false);
    expect(() => fromRequirementsIllustration.migrate({ profile: "cnsi-core" })).toThrow();
  });
});

describe("public samples are synthetic", () => {
  it("every example and conformance guide is labeled synthetic", async () => {
    const { readdirSync } = await import("node:fs");
    const files = [
      ...readdirSync(new URL("../examples/", import.meta.url))
        .filter((f) => f.endsWith(".json"))
        .map((f) => `../examples/${f}`),
      ...readdirSync(new URL("../conformance/cases/", import.meta.url)).map(
        (f) => `../conformance/cases/${f}`,
      ),
    ];
    for (const f of files) {
      const text = readFileSync(new URL(f, import.meta.url), "utf8");
      expect(text, f).toMatch(/"synthetic": true/);
      expect(text, f).toMatch(/SYNTHETIC/);
    }
  });
});
