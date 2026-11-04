// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * OpenSCG reference library.
 *
 * OpenSCG is a proposed open interchange format for security classification
 * guides. It is not an official government standard, and nothing in this
 * library grants classification authority or makes a classification decision.
 */

/** The OpenSCG specification version this library implements. */
export const SPEC_VERSION = "0.1.0-draft";

export {
  BLOCKING_SEVERITIES,
  type Finding,
  isApprovalReady,
  pointer,
  pointerToken,
  type Severity,
} from "./findings.js";
export { GUIDE_SCHEMA_0_1 } from "./generated/schema.js";
export { GUIDE_SCHEMA_ID, STRUCTURE_CODE, validateStructure } from "./structure.js";
