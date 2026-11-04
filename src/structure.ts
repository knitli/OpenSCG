// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";
import type { Finding } from "./findings.js";
import { GUIDE_SCHEMA_0_1 } from "./generated/schema.js";

/** The `$id` of the OpenSCG 0.1 guide schema. */
export const GUIDE_SCHEMA_ID = GUIDE_SCHEMA_0_1.$id;

/** Finding code for any JSON Schema failure. */
export const STRUCTURE_CODE = "OSCG-S000";

// ajv-formats is CommonJS; under NodeNext its default export arrives wrapped.
const addFormats = ((addFormatsImport as unknown as { default?: unknown }).default ??
  addFormatsImport) as unknown as (ajv: Ajv2020) => Ajv2020;

let compiled: ReturnType<Ajv2020["compile"]> | undefined;

function validator() {
  if (!compiled) {
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
    addFormats(ajv);
    compiled = ajv.compile(GUIDE_SCHEMA_0_1 as unknown as object);
  }
  return compiled;
}

function describe(err: ErrorObject): string {
  switch (err.keyword) {
    case "required":
      return `Missing required field "${(err.params as { missingProperty: string }).missingProperty}".`;
    case "additionalProperties":
      return `Unknown field "${(err.params as { additionalProperty: string }).additionalProperty}". Use "extensions" for supplemental data.`;
    case "enum":
      return `Value must be one of: ${(err.params as { allowedValues: unknown[] }).allowedValues.map((v) => JSON.stringify(v)).join(", ")}.`;
    case "const":
      return `Value must be ${JSON.stringify((err.params as { allowedValue: unknown }).allowedValue)}.`;
    default:
      return `Schema check "${err.keyword}" failed: ${err.message ?? "invalid value"}.`;
  }
}

/**
 * Check a parsed document against the OpenSCG 0.1 JSON Schema.
 *
 * This is structural validation only (specification section 6). It does not check
 * references, profile rules, or approval readiness; use `validate()` for those.
 */
export function validateStructure(document: unknown): Finding[] {
  const validate = validator();
  if (validate(document)) return [];
  const seen = new Set<string>();
  const findings: Finding[] = [];
  for (const err of validate.errors ?? []) {
    const pointer =
      err.keyword === "required"
        ? `${err.instancePath}/${(err.params as { missingProperty: string }).missingProperty}`
        : err.keyword === "additionalProperties"
          ? `${err.instancePath}/${(err.params as { additionalProperty: string }).additionalProperty}`
          : err.instancePath;
    const message = describe(err);
    const key = `${pointer}\u0000${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({ code: STRUCTURE_CODE, severity: "error", pointer, message });
  }
  return findings;
}
