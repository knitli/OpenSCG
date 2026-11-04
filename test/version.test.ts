// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SPEC_VERSION } from "../src/index.js";

describe("SPEC_VERSION", () => {
  it("is the version recorded in spec/VERSION", () => {
    const recorded = readFileSync(new URL("../spec/VERSION", import.meta.url), "utf8").trim();
    expect(SPEC_VERSION).toBe(recorded);
  });
});
