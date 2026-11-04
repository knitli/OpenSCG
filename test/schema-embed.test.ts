// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GUIDE_SCHEMA_0_1 } from "../src/index.js";

describe("embedded schema", () => {
  it("matches schema/0.1/guide.schema.json exactly", () => {
    const onDisk = JSON.parse(
      readFileSync(new URL("../schema/0.1/guide.schema.json", import.meta.url), "utf8"),
    );
    expect(GUIDE_SCHEMA_0_1).toEqual(onDisk);
  });
});
