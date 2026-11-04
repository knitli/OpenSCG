// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareForLoss } from "../src/index.js";

const lantern = () =>
  JSON.parse(readFileSync(new URL("../examples/synthetic-lantern.json", import.meta.url), "utf8"));

describe("compareForLoss", () => {
  it("reports nothing for an identical copy", () => {
    expect(compareForLoss(lantern(), lantern())).toEqual({ complete: true, items: [] });
  });

  it("reports a removed field at its pointer", () => {
    const after = lantern();
    delete after.entries[2].statements.damage;
    expect(compareForLoss(lantern(), after).items).toEqual([
      { pointer: "/entries/2/statements/damage", kind: "removed" },
    ]);
  });

  it("reports a changed value", () => {
    const after = lantern();
    after.entries[2].level = "C";
    expect(compareForLoss(lantern(), after).items).toEqual([
      { pointer: "/entries/2/level", kind: "changed" },
    ]);
  });

  it("reports a dropped extension, escaping the pointer", () => {
    const before = lantern();
    before.extensions = { "org.example/x": { must_understand: false, data: 1 } };
    const after = lantern();
    const r = compareForLoss(before, after);
    expect(r.complete).toBe(false);
    expect(r.items).toEqual([{ pointer: "/extensions", kind: "removed" }]);
  });

  it("reports truncated arrays", () => {
    const after = lantern();
    after.entries.pop();
    expect(compareForLoss(lantern(), after).items).toEqual([
      { pointer: "/entries/5", kind: "removed" },
    ]);
  });

  it("does not report additions", () => {
    const after = lantern();
    after.notes_added = "x";
    expect(compareForLoss(lantern(), after).complete).toBe(true);
  });

  it("distinguishes 1 from true and null from absent", () => {
    expect(compareForLoss({ a: 1 }, { a: true }).items).toHaveLength(1);
    expect(compareForLoss({ a: null }, {}).items).toEqual([{ pointer: "/a", kind: "removed" }]);
  });
});
