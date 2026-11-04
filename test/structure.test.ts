// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateStructure } from "../src/index.js";

const load = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const lantern = () => load("../examples/synthetic-lantern.json");

describe("validateStructure", () => {
  const examples = readdirSync(new URL("../examples/", import.meta.url)).filter((f) =>
    f.endsWith(".json"),
  );

  it.each(examples)("accepts example %s", (file) => {
    expect(validateStructure(load(`../examples/${file}`))).toEqual([]);
  });

  it("reports a missing required field at its exact pointer", () => {
    const doc = lantern();
    delete doc.entries[2].description;
    expect(validateStructure(doc)).toContainEqual(
      expect.objectContaining({ code: "OSCG-S000", pointer: "/entries/2/description" }),
    );
  });

  it("rejects an unknown field instead of ignoring it", () => {
    const doc = lantern();
    doc.entries[0].color = "blue";
    expect(validateStructure(doc)).toContainEqual(
      expect.objectContaining({ pointer: "/entries/0/color" }),
    );
  });

  it("rejects a level outside U/C/S/TS", () => {
    const doc = lantern();
    doc.entries[0].level = "SECRET";
    expect(validateStructure(doc).some((f) => f.pointer === "/entries/0/level")).toBe(true);
  });

  it("rejects an entry with both level and level_range", () => {
    const doc = lantern();
    doc.entries[3].level = "C";
    expect(validateStructure(doc).length).toBeGreaterThan(0);
  });

  it("rejects a level range without conditions", () => {
    const doc = lantern();
    delete doc.entries[3].level_range.condition_text;
    expect(validateStructure(doc)).toContainEqual(
      expect.objectContaining({ pointer: "/entries/3/level_range/condition_text" }),
    );
  });

  it("rejects a reason with no categories", () => {
    const doc = lantern();
    doc.entries[2].reason.categories = [];
    expect(validateStructure(doc).some((f) => f.pointer === "/entries/2/reason/categories")).toBe(
      true,
    );
  });

  it("rejects an OCA with a name but neither position nor identifier", () => {
    const doc = lantern();
    delete doc.oca.position;
    expect(validateStructure(doc).length).toBeGreaterThan(0);
  });

  it("rejects an extension key that is not a reverse-DNS namespace", () => {
    const doc = lantern();
    doc.extensions = { widgets: { must_understand: false, data: {} } };
    expect(validateStructure(doc).length).toBeGreaterThan(0);
  });

  it("accepts a well-formed extension", () => {
    const doc = lantern();
    doc.extensions = { "org.example.widgets": { must_understand: false, data: { a: 1 } } };
    expect(validateStructure(doc)).toEqual([]);
  });

  it("rejects the wrong schema_version", () => {
    const doc = lantern();
    doc.schema_version = "9.9.9";
    expect(validateStructure(doc)).toContainEqual(
      expect.objectContaining({ pointer: "/schema_version" }),
    );
  });
});
