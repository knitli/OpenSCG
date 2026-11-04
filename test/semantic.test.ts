// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type Finding, isApprovalReady, RULES, type RuleCode, validate } from "../src/index.js";

// biome-ignore lint/suspicious/noExplicitAny: test fixtures are mutated freely
type Doc = any;
const load = (path: string): Doc =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const lantern = (): Doc => load("../examples/synthetic-lantern.json");

/** LANTERN with its markings review completed, so it has no blocking findings. */
const ready = (): Doc => {
  const d = lantern();
  d.document_markings.review = { status: "complete", reviewed_by: "Synthetic Reviewer" };
  return d;
};

const codes = (fs: Finding[]) => fs.map((f) => f.code).sort();
const triggered = new Set<string>();

function expectOnly(doc: Doc, code: RuleCode, pointer?: string, options = {}) {
  const findings = validate(doc, options);
  for (const f of findings) triggered.add(f.code);
  expect(codes(findings)).toEqual([code]);
  if (pointer !== undefined) expect(findings[0]?.pointer).toBe(pointer);
  return findings;
}

describe("baseline", () => {
  it("LANTERN with reviewed markings has no findings", () => {
    expect(validate(ready())).toEqual([]);
    expect(isApprovalReady(validate(ready()))).toBe(true);
  });

  it("LANTERN as shipped is blocked only by the pending markings review", () => {
    const fs = validate(lantern());
    expect(codes(fs)).toEqual(["OSCG-V046"]);
    expect(isApprovalReady(fs)).toBe(false);
  });

  it("an unclassified entry needs no reason or declassification", () => {
    const d = ready();
    d.entries = [d.entries[0]];
    expect(d.entries[0].reason).toBeUndefined();
    expect(validate(d)).toEqual([]);
  });

  it("the requirements compilation example keeps its constituents unclassified", () => {
    const d = load("../examples/requirements-compilation.json");
    const fs = validate(d);
    expect(fs.filter((f) => f.pointer.startsWith("/entries"))).toEqual([]);
    expect(d.entries[0].level).toBe("U");
    expect(d.entries[1].level).toBe("U");
  });
});

describe("ISOO FY2025 failure patterns", () => {
  it("levels not mapped to specific elements: a guide with no entries", () => {
    const d = ready();
    d.entries = [];
    expectOnly(d, "OSCG-V011", "/entries");
  });

  it("missing declassification instruction", () => {
    const d = ready();
    delete d.entries[2].declassification;
    expectOnly(d, "OSCG-V013", "/entries/2/declassification");
  });

  it("missing classification reasoning", () => {
    const d = ready();
    delete d.entries[2].reason;
    expectOnly(d, "OSCG-V010", "/entries/2/reason");
  });

  it("missing reasoning is also caught on a level range whose top is classified", () => {
    const d = ready();
    delete d.entries[3].reason;
    expectOnly(d, "OSCG-V010", "/entries/3/reason");
  });
});

describe("identifiers and references", () => {
  it("duplicate entry_id", () => {
    const d = ready();
    d.entries[1].entry_id = "gen-name";
    // The compilation now references a missing "gen-sponsor" as well.
    const fs = validate(d);
    for (const f of fs) triggered.add(f.code);
    expect(codes(fs)).toEqual(["OSCG-V001", "OSCG-V003"]);
    expect(fs.find((f) => f.code === "OSCG-V001")?.pointer).toBe("/entries/1/entry_id");
  });

  it("duplicate section_id", () => {
    const d = ready();
    d.sections[1].section_id = "general";
    // Entries in "performance" now point at a missing section; only check V002 is present.
    const fs = validate(d);
    for (const f of fs) triggered.add(f.code);
    expect(fs.find((f) => f.code === "OSCG-V002")?.pointer).toBe("/sections/1/section_id");
  });

  it("dangling reference", () => {
    const d = ready();
    d.entries[5].references = ["gen-sponsor", "does-not-exist"];
    expectOnly(d, "OSCG-V003", "/entries/5/references/1");
  });

  it("unknown section", () => {
    const d = ready();
    d.entries[0].section_id = "nowhere";
    expectOnly(d, "OSCG-V004", "/entries/0/section_id");
  });

  it("self reference", () => {
    const d = ready();
    d.entries[0].references = ["gen-name"];
    expectOnly(d, "OSCG-V005", "/entries/0/references/0");
  });
});

describe("levels, compilations and declassification", () => {
  it("inverted level range", () => {
    const d = ready();
    d.entries[3].level_range.lowest = "S";
    expectOnly(d, "OSCG-V014", "/entries/3/level_range");
  });

  it("degenerate level range", () => {
    const d = ready();
    d.entries[3].level_range.lowest = "C";
    expectOnly(d, "OSCG-V015");
  });

  it("compilation without condition_text", () => {
    const d = ready();
    delete d.entries[5].condition_text;
    expectOnly(d, "OSCG-V016", "/entries/5/condition_text");
  });

  it("compilation with one constituent", () => {
    const d = ready();
    d.entries[5].references = ["gen-sponsor"];
    expectOnly(d, "OSCG-V017", "/entries/5/references");
  });

  it("compilation no higher than a constituent", () => {
    const d = ready();
    d.entries[5].references = ["gen-sponsor", "perf-range"];
    expectOnly(d, "OSCG-V018", "/entries/5/level");
  });

  it("unclassified entry with a reason", () => {
    const d = ready();
    d.entries[0].reason = { categories: ["1.4(a)"], explanation: "Synthetic" };
    expectOnly(d, "OSCG-V019", "/entries/0/reason");
  });

  it("exemption without evidence", () => {
    const d = ready();
    d.entries[2].declassification = { kind: "exemption", code: "25X1" };
    expectOnly(d, "OSCG-V020", "/entries/2/declassification/authority");
  });

  it("exemption with evidence is not flagged", () => {
    const d = ready();
    d.entries[2].declassification = {
      kind: "exemption",
      code: "25X1",
      authority: { kind: "iscap_approval", reference: "Synthetic approval EX-25X1-0001" },
    };
    expect(validate(d)).toEqual([]);
  });

  it("special exemption code is sent to policy review even with evidence", () => {
    const d = ready();
    d.entries[2].declassification = {
      kind: "exemption",
      code: "50X1-HUM",
      authority: { reference: "Synthetic" },
    };
    expectOnly(d, "OSCG-V021", "/entries/2/declassification/code");
  });

  it("exemption with until date and until event", () => {
    const d = ready();
    d.entries[2].declassification = {
      kind: "exemption",
      code: "25X1",
      authority: { reference: "Synthetic" },
      until_date: "2050-01-01",
      until_event_text: "Synthetic event",
    };
    expectOnly(d, "OSCG-V022");
  });

  it("declassification date before issue", () => {
    const d = ready();
    d.entries[3].declassification.date = "2020-01-01";
    expectOnly(d, "OSCG-V023", "/entries/3/declassification/date");
  });

  it("relative declassification is left relative", () => {
    const d = ready();
    expect(d.entries[2].declassification).toEqual({
      kind: "relative_to_record_creation",
      years: 25,
    });
    expect(validate(d)).toEqual([]);
  });
});

describe("unsupported and unverified", () => {
  it("AEA information blocks approval", () => {
    const d = ready();
    d.entries[2].regime = "aea";
    const fs = expectOnly(d, "OSCG-V030", "/entries/2/regime");
    expect(isApprovalReady(fs)).toBe(false);
  });

  it("unknown profile", () => {
    const d = ready();
    d.profile = "example-profile";
    expectOnly(d, "OSCG-V031", "/profile");
  });

  it("DoD profile warns it is unverified", () => {
    const d = ready();
    d.profile = "dod-5200.45";
    const fs = expectOnly(d, "OSCG-V032", "/profile");
    expect(isApprovalReady(fs)).toBe(true);
  });

  it("unknown must-understand extension blocks approval", () => {
    const d = ready();
    d.entries[1].extensions = { "org.example.rules": { must_understand: true, data: { x: 1 } } };
    const fs = expectOnly(d, "OSCG-V033", "/entries/1/extensions/org.example.rules");
    expect(isApprovalReady(fs)).toBe(false);
  });

  it("a supported must-understand extension is accepted", () => {
    const d = ready();
    d.extensions = { "org.example.rules": { must_understand: true, data: {} } };
    expect(validate(d, { supportedExtensions: ["org.example.rules"] })).toEqual([]);
  });

  it("unknown optional extension is a warning", () => {
    const d = ready();
    d.extensions = { "org.example.notes": { must_understand: false, data: "x" } };
    const fs = expectOnly(d, "OSCG-V034", "/extensions/org.example.notes");
    expect(isApprovalReady(fs)).toBe(true);
  });
});

describe("guide-level content", () => {
  const cases: [string, (d: Doc) => void, RuleCode, string][] = [
    ["no subject", (d) => delete d.subject, "OSCG-V040", "/subject"],
    ["no OCA", (d) => delete d.oca, "OSCG-V041", "/oca"],
    ["no point of contact", (d) => delete d.point_of_contact, "OSCG-V042", "/point_of_contact"],
    ["no dates", (d) => delete d.dates, "OSCG-V043", "/dates"],
    [
      "no banner",
      (d) => delete d.document_markings.banner,
      "OSCG-V044",
      "/document_markings/banner",
    ],
    [
      "classified document without authority block",
      (d) => {
        d.document_markings.classification = "C";
      },
      "OSCG-V045",
      "/document_markings/classification_authority_block",
    ],
    [
      "markings not reviewed",
      (d) => delete d.document_markings.review,
      "OSCG-V046",
      "/document_markings/review",
    ],
    [
      "OCA level below guide",
      (d) => {
        d.oca.highest_level = "C";
      },
      "OSCG-V049",
      "/oca/highest_level",
    ],
    [
      "delegation below guide",
      (d) => {
        d.authority.claimed_delegation.highest_level = "C";
      },
      "OSCG-V050",
      "/authority/claimed_delegation/highest_level",
    ],
    ["no OCA level", (d) => delete d.oca.highest_level, "OSCG-V052", "/oca/highest_level"],
  ];
  it.each(cases)("%s", (_name, mutate, code, at) => {
    const d = ready();
    mutate(d);
    expectOnly(d, code, at);
  });

  it("a classified document with an authority block passes", () => {
    const d = ready();
    d.document_markings.classification = "C";
    d.document_markings.classification_authority_block = { classified_by: "Synthetic" };
    expect(validate(d)).toEqual([]);
  });

  it("a draft with errors still validates without throwing", () => {
    const d = ready();
    d.entries.push({ entry_id: "x", kind: "element", description: "Synthetic", level: "TS" });
    const fs = validate(d);
    expect(fs.length).toBeGreaterThan(0);
  });
});

describe("structural failures short-circuit semantics", () => {
  it("returns only OSCG-S000 findings when the schema fails", () => {
    const d = ready();
    d.entries[0].level = "SECRET";
    expect(new Set(codes(validate(d)))).toEqual(new Set(["OSCG-S000"]));
  });
});

// Declared last so it runs after every other test in a full-file run.
it("exercises every rule in RULES", () => {
  const missing = Object.keys(RULES).filter((c) => !triggered.has(c));
  expect(missing).toEqual([]);
});
