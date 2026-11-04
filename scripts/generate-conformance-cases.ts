// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Writes conformance/cases/ and conformance/manifest.json.
// Run: npm run conformance:generate
//
// Expected results are written out explicitly here, by hand, from the
// specification. They are NOT computed by the reference library; that would
// make the suite check the library against itself.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

// biome-ignore lint/suspicious/noExplicitAny: fixtures are mutated freely
type Doc = any;
type Expect = [code: string, pointer: string][];

const lantern = (): Doc => JSON.parse(readFileSync("examples/synthetic-lantern.json", "utf8"));
const ready = (): Doc => {
  const d = lantern();
  d.document_markings.review = { status: "complete", reviewed_by: "SYNTHETIC Reviewer" };
  return d;
};

interface Case {
  id: string;
  description: string;
  doc?: Doc;
  raw?: string;
  parse_error?: string;
  structure?: "valid" | "invalid";
  findings?: Expect;
  approval_ready?: boolean;
}

const cases: Case[] = [];
const semantic = (
  id: string,
  description: string,
  mutate: (d: Doc) => void,
  findings: Expect,
  approval_ready: boolean,
) => {
  const d = ready();
  mutate(d);
  cases.push({ id, description, doc: d, structure: "valid", findings, approval_ready });
};
const structural = (id: string, description: string, mutate: (d: Doc) => void) => {
  const d = ready();
  mutate(d);
  cases.push({ id, description, doc: d, structure: "invalid", approval_ready: false });
};

// --- Valid documents ------------------------------------------------------
cases.push({
  id: "valid-lantern-reviewed",
  description: "LANTERN with reviewed markings: no findings.",
  doc: ready(),
  structure: "valid",
  findings: [],
  approval_ready: true,
});
cases.push({
  id: "valid-lantern-as-shipped",
  description: "LANTERN as shipped: blocked only by the pending markings review.",
  doc: lantern(),
  structure: "valid",
  findings: [["OSCG-V046", "/document_markings/review"]],
  approval_ready: false,
});
semantic(
  "valid-unclassified-only",
  "A valid unclassified entry needs no classified-only fields.",
  (d) => {
    d.entries = [d.entries[0]];
    delete d.oca.highest_level;
  },
  [],
  true,
);
semantic(
  "valid-exemption-with-evidence",
  "An exemption with authority evidence is not flagged.",
  (d) => {
    d.entries[2].declassification = {
      kind: "exemption",
      code: "25X1",
      authority: { kind: "iscap_approval", reference: "SYNTHETIC approval EX-0001" },
    };
  },
  [],
  true,
);
semantic(
  "valid-supported-extension-ignored-safely",
  "An optional unknown extension is preserved with a warning.",
  (d) => {
    d.extensions = { "org.example.notes": { must_understand: false, data: { note: "SYNTHETIC" } } };
  },
  [["OSCG-V034", "/extensions/org.example.notes"]],
  true,
);

// --- ISOO FY2025 failure patterns ------------------------------------------
semantic(
  "fy2025-no-elements",
  "ISOO FY2025: levels not mapped to specific elements (no entries).",
  (d) => {
    d.entries = [];
  },
  [["OSCG-V011", "/entries"]],
  false,
);
semantic(
  "fy2025-no-declassification",
  "ISOO FY2025: a classified element lacks a declassification instruction.",
  (d) => {
    delete d.entries[2].declassification;
  },
  [["OSCG-V013", "/entries/2/declassification"]],
  false,
);
semantic(
  "fy2025-no-reason",
  "ISOO FY2025: a classified element lacks classification reasoning.",
  (d) => {
    delete d.entries[2].reason;
  },
  [["OSCG-V010", "/entries/2/reason"]],
  false,
);

// --- Identifiers and references --------------------------------------------
semantic(
  "duplicate-entry-id",
  "Two entries share an entry_id.",
  (d) => {
    d.entries[1].entry_id = "gen-name";
  },
  [
    ["OSCG-V001", "/entries/1/entry_id"],
    ["OSCG-V003", "/entries/5/references/0"],
  ],
  false,
);
semantic(
  "dangling-reference",
  "A compilation references an entry that does not exist.",
  (d) => {
    d.entries[5].references = ["gen-sponsor", "missing-entry"];
  },
  [["OSCG-V003", "/entries/5/references/1"]],
  false,
);
semantic(
  "unknown-section",
  "An entry names a section that does not exist.",
  (d) => {
    d.entries[0].section_id = "nowhere";
  },
  [["OSCG-V004", "/entries/0/section_id"]],
  false,
);
semantic(
  "self-reference",
  "An entry references itself.",
  (d) => {
    d.entries[0].references = ["gen-name"];
  },
  [["OSCG-V005", "/entries/0/references/0"]],
  false,
);

// --- Levels, compilations, declassification --------------------------------
semantic(
  "inverted-range",
  "A level range whose lowest is above its highest.",
  (d) => {
    d.entries[3].level_range.lowest = "S";
  },
  [["OSCG-V014", "/entries/3/level_range"]],
  false,
);
semantic(
  "compilation-no-condition",
  "A compilation without condition_text.",
  (d) => {
    delete d.entries[5].condition_text;
  },
  [["OSCG-V016", "/entries/5/condition_text"]],
  false,
);
semantic(
  "compilation-not-higher",
  "A compilation that adds no protection over a constituent.",
  (d) => {
    d.entries[5].references = ["gen-sponsor", "perf-range"];
  },
  [["OSCG-V018", "/entries/5/level"]],
  true,
);
semantic(
  "unclassified-with-reason",
  "An unclassified entry with a classified reason.",
  (d) => {
    d.entries[0].reason = { categories: ["1.4(a)"], explanation: "SYNTHETIC" };
  },
  [["OSCG-V019", "/entries/0/reason"]],
  true,
);
semantic(
  "exemption-no-evidence",
  "An exemption code with no authority evidence.",
  (d) => {
    d.entries[2].declassification = { kind: "exemption", code: "25X1" };
  },
  [["OSCG-V020", "/entries/2/declassification/authority"]],
  false,
);
semantic(
  "exemption-hum",
  "50X1-HUM always goes to policy review.",
  (d) => {
    d.entries[2].declassification = {
      kind: "exemption",
      code: "50X1-HUM",
      authority: { reference: "SYNTHETIC" },
    };
  },
  [["OSCG-V021", "/entries/2/declassification/code"]],
  false,
);

// --- Unsupported -----------------------------------------------------------
semantic(
  "aea-entry",
  "Atomic Energy Act information is unsupported and blocks approval.",
  (d) => {
    d.entries[2].regime = "aea";
  },
  [["OSCG-V030", "/entries/2/regime"]],
  false,
);
cases.push({
  id: "unsupported-schema-version",
  description:
    "A file from a version this suite does not cover is reported as unsupported, not interpreted.",
  doc: { ...ready(), schema_version: "0.2.0" },
  structure: "invalid",
  findings: [["OSCG-V035", "/schema_version"]],
  approval_ready: false,
});
semantic(
  "unknown-profile",
  "An unknown profile is unsupported.",
  (d) => {
    d.profile = "example-profile";
  },
  [["OSCG-V031", "/profile"]],
  false,
);
semantic(
  "dod-profile-unverified",
  "The DoD profile warns that it is unverified.",
  (d) => {
    d.profile = "dod-5200.45";
  },
  [["OSCG-V032", "/profile"]],
  true,
);
semantic(
  "must-understand-extension",
  "An unsupported must-understand extension blocks approval.",
  (d) => {
    d.entries[1].extensions = {
      "org.example.rules": { must_understand: true, data: { rule: "SYNTHETIC" } },
    };
  },
  [["OSCG-V033", "/entries/1/extensions/org.example.rules"]],
  false,
);

// --- Guide-level content ----------------------------------------------------
semantic(
  "no-oca",
  "No original classification authority.",
  (d) => {
    delete d.oca;
  },
  [["OSCG-V041", "/oca"]],
  false,
);
semantic(
  "no-dates",
  "No issue or last-review date.",
  (d) => {
    delete d.dates;
  },
  [["OSCG-V043", "/dates"]],
  false,
);
semantic(
  "classified-document-no-cab",
  "A classified guide without its own classification authority block.",
  (d) => {
    d.document_markings.classification = "C";
  },
  [["OSCG-V045", "/document_markings/classification_authority_block"]],
  false,
);
semantic(
  "oca-level-too-low",
  "The OCA's claimed level is below the guide's highest level.",
  (d) => {
    d.oca.highest_level = "C";
  },
  [["OSCG-V049", "/oca/highest_level"]],
  false,
);

// --- Structural failures ----------------------------------------------------
structural("structure-missing-description", "An entry without a description.", (d) => {
  delete d.entries[2].description;
});
structural("structure-unknown-field", "An unknown field outside extensions.", (d) => {
  d.entries[0].color = "blue";
});
structural("structure-bad-level", "A level outside U/C/S/TS.", (d) => {
  d.entries[0].level = "SECRET";
});
structural("structure-level-and-range", "An entry with both level and level_range.", (d) => {
  d.entries[3].level = "C";
});
structural("structure-range-no-condition", "A level range with no condition_text.", (d) => {
  delete d.entries[3].level_range.condition_text;
});
structural("structure-empty-categories", "A reason with no categories.", (d) => {
  d.entries[2].reason.categories = [];
});
structural("structure-bad-date", "A date that is not a calendar date.", (d) => {
  d.dates.issued = "2026-02-30";
});
structural("structure-bad-namespace", "An extension key that is not a namespace.", (d) => {
  d.extensions = { widgets: { must_understand: false, data: 1 } };
});

// --- Strict-parse failures ---------------------------------------------------
const text = JSON.stringify(ready(), null, 2);
cases.push({
  id: "parse-duplicate-level",
  description: "An entry states its level twice. Lenient parsers keep one silently.",
  raw: text.replace('"level": "S",', '"level": "U",\n      "level": "S",'),
  parse_error: "OSCG-P003",
});

// --- Write -------------------------------------------------------------------
rmSync("conformance/cases", { recursive: true, force: true });
mkdirSync("conformance/cases", { recursive: true });
const manifest = cases.map((c) => {
  const file = `cases/${c.id}.json`;
  writeFileSync(`conformance/${file}`, c.raw ?? `${JSON.stringify(c.doc, null, 2)}\n`);
  const expected: Record<string, unknown> = c.parse_error
    ? { parse_error: c.parse_error }
    : {
        structure: c.structure,
        ...(c.findings
          ? {
              findings: c.findings
                .map(([code, pointer]) => ({ code, pointer }))
                .sort((a, b) => (a.code + a.pointer).localeCompare(b.code + b.pointer)),
            }
          : {}),
        approval_ready: c.approval_ready,
      };
  return { id: c.id, description: c.description, file, expected };
});
writeFileSync(
  "conformance/manifest.json",
  `${JSON.stringify(
    {
      description:
        "OpenSCG validation conformance cases. See spec/conformance.md for the procedure. All content is SYNTHETIC.",
      spec_version: "0.1.0",
      suite_version: "0.1.0",
      cases: manifest,
    },
    null,
    2,
  )}\n`,
);
console.log(`${manifest.length} cases`);
