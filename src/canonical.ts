// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Strict JSON parsing (specification section 8.2) and RFC 8785 JSON
// Canonicalization Scheme (section 8.3).
//
// A strict parser is written here on purpose: JSON.parse silently keeps the
// last of two duplicate member names, so two files with different visible
// content could canonicalize to the same bytes. The specification forbids that.

/** Limits applied while parsing untrusted input. */
export interface ParseLimits {
  /** Maximum input size in bytes. Default 16 MiB. */
  readonly maxBytes?: number;
  /** Maximum nesting depth of arrays and objects. Default 64. */
  readonly maxDepth?: number;
}

export const DEFAULT_LIMITS = { maxBytes: 16 * 1024 * 1024, maxDepth: 64 } as const;

/** Why strict parsing failed. Codes are listed in specification section 8.2. */
export class StrictParseError extends Error {
  constructor(
    readonly code:
      | "OSCG-P001" // not valid UTF-8, or has a byte-order mark
      | "OSCG-P002" // not valid JSON
      | "OSCG-P003" // duplicate member name
      | "OSCG-P004" // unpaired surrogate
      | "OSCG-P005" // number cannot be represented exactly
      | "OSCG-P006", // size or depth limit exceeded
    message: string,
    readonly offset: number,
  ) {
    super(`${code}: ${message} (at character ${offset})`);
    this.name = "StrictParseError";
  }
}

const MAX_EXACT_INTEGER = 2 ** 53 - 1;

class Parser {
  private i = 0;
  constructor(
    private readonly s: string,
    private readonly maxDepth: number,
  ) {}

  parse(): unknown {
    this.ws();
    const v = this.value(0);
    this.ws();
    if (this.i !== this.s.length)
      this.fail("OSCG-P002", "Unexpected content after the JSON value.");
    return v;
  }

  private fail(code: StrictParseError["code"], message: string): never {
    throw new StrictParseError(code, message, this.i);
  }

  private ws() {
    while (this.i < this.s.length) {
      const c = this.s.charCodeAt(this.i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) this.i++;
      else break;
    }
  }

  private value(depth: number): unknown {
    const c = this.s[this.i];
    switch (c) {
      case "{":
        return this.object(depth + 1);
      case "[":
        return this.array(depth + 1);
      case '"':
        return this.string();
      case "t":
        return this.literal("true", true);
      case "f":
        return this.literal("false", false);
      case "n":
        return this.literal("null", null);
      default:
        if (c === "-" || (c !== undefined && c >= "0" && c <= "9")) return this.number();
        return this.fail("OSCG-P002", "Expected a JSON value.");
    }
  }

  private literal<T>(word: string, v: T): T {
    if (this.s.startsWith(word, this.i)) {
      this.i += word.length;
      return v;
    }
    return this.fail("OSCG-P002", `Expected "${word}".`);
  }

  private object(depth: number): Record<string, unknown> {
    if (depth > this.maxDepth) this.fail("OSCG-P006", "Nesting is too deep.");
    this.i++; // {
    // A null-prototype object, so a member named "__proto__" is ordinary data.
    const out: Record<string, unknown> = Object.create(null);
    const seen = new Set<string>();
    this.ws();
    if (this.s[this.i] === "}") {
      this.i++;
      return out;
    }
    for (;;) {
      this.ws();
      if (this.s[this.i] !== '"') this.fail("OSCG-P002", "Expected a member name.");
      const at = this.i;
      const key = this.string();
      if (seen.has(key)) {
        throw new StrictParseError("OSCG-P003", `Member name "${key}" appears more than once.`, at);
      }
      seen.add(key);
      this.ws();
      if (this.s[this.i] !== ":") this.fail("OSCG-P002", 'Expected ":".');
      this.i++;
      this.ws();
      out[key] = this.value(depth);
      this.ws();
      const c = this.s[this.i];
      if (c === ",") {
        this.i++;
        continue;
      }
      if (c === "}") {
        this.i++;
        return out;
      }
      this.fail("OSCG-P002", 'Expected "," or "}".');
    }
  }

  private array(depth: number): unknown[] {
    if (depth > this.maxDepth) this.fail("OSCG-P006", "Nesting is too deep.");
    this.i++; // [
    const out: unknown[] = [];
    this.ws();
    if (this.s[this.i] === "]") {
      this.i++;
      return out;
    }
    for (;;) {
      this.ws();
      out.push(this.value(depth));
      this.ws();
      const c = this.s[this.i];
      if (c === ",") {
        this.i++;
        continue;
      }
      if (c === "]") {
        this.i++;
        return out;
      }
      this.fail("OSCG-P002", 'Expected "," or "]".');
    }
  }

  private string(): string {
    this.i++; // opening quote
    let out = "";
    for (;;) {
      if (this.i >= this.s.length) this.fail("OSCG-P002", "Unterminated string.");
      const c = this.s.charCodeAt(this.i);
      if (c === 0x22) {
        this.i++;
        break;
      }
      if (c < 0x20) this.fail("OSCG-P002", "Control characters must be escaped in strings.");
      if (c === 0x5c) {
        const e = this.s[this.i + 1];
        this.i += 2;
        switch (e) {
          case '"':
            out += '"';
            break;
          case "\\":
            out += "\\";
            break;
          case "/":
            out += "/";
            break;
          case "b":
            out += "\b";
            break;
          case "f":
            out += "\f";
            break;
          case "n":
            out += "\n";
            break;
          case "r":
            out += "\r";
            break;
          case "t":
            out += "\t";
            break;
          case "u": {
            const hex = this.s.slice(this.i, this.i + 4);
            if (!/^[0-9A-Fa-f]{4}$/.test(hex)) this.fail("OSCG-P002", "Invalid \\u escape.");
            out += String.fromCharCode(Number.parseInt(hex, 16));
            this.i += 4;
            break;
          }
          default:
            this.fail("OSCG-P002", "Invalid escape sequence.");
        }
        continue;
      }
      out += this.s[this.i];
      this.i++;
    }
    if (!out.isWellFormed()) this.fail("OSCG-P004", "String contains an unpaired surrogate.");
    return out;
  }

  private number(): number {
    const start = this.i;
    const m = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(this.s.slice(this.i));
    if (!m) return this.fail("OSCG-P002", "Invalid number.");
    this.i += m[0].length;
    const n = Number(m[0]);
    if (!Number.isFinite(n)) {
      throw new StrictParseError("OSCG-P005", "Number is too large to represent.", start);
    }
    // An integer written without fraction or exponent must be exactly representable.
    // An integer written without fraction or exponent must be exactly
    // representable as an IEEE 754 double; otherwise two different integers
    // would canonicalize to the same bytes.
    if (
      m[2] === undefined &&
      m[3] === undefined &&
      Math.abs(n) > MAX_EXACT_INTEGER &&
      BigInt(m[0]) !== BigInt(n)
    ) {
      throw new StrictParseError(
        "OSCG-P005",
        "Integer cannot be represented exactly; it would silently change value.",
        start,
      );
    }
    return n;
  }
}

/**
 * Parse JSON text strictly (specification section 8.2).
 *
 * Accepts a string, or bytes that must be UTF-8 without a byte-order mark.
 * Rejects duplicate member names, unpaired surrogates, unrepresentable numbers,
 * and input beyond the size or depth limits.
 */
export function parseStrict(input: string | Uint8Array, limits: ParseLimits = {}): unknown {
  const maxBytes = limits.maxBytes ?? DEFAULT_LIMITS.maxBytes;
  const maxDepth = limits.maxDepth ?? DEFAULT_LIMITS.maxDepth;
  let text: string;
  if (typeof input === "string") {
    text = input;
    if (text.length > maxBytes) throw new StrictParseError("OSCG-P006", "Input is too large.", 0);
  } else {
    if (input.byteLength > maxBytes)
      throw new StrictParseError("OSCG-P006", "Input is too large.", 0);
    if (input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf) {
      throw new StrictParseError("OSCG-P001", "Input starts with a byte-order mark.", 0);
    }
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(input);
    } catch {
      throw new StrictParseError("OSCG-P001", "Input is not valid UTF-8.", 0);
    }
  }
  if (text.charCodeAt(0) === 0xfeff) {
    throw new StrictParseError("OSCG-P001", "Input starts with a byte-order mark.", 0);
  }
  return new Parser(text, maxDepth).parse();
}

/** Why a value cannot be canonicalized. */
export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalizationError";
  }
}

function serialize(v: unknown, out: string[]) {
  if (v === null) {
    out.push("null");
    return;
  }
  switch (typeof v) {
    case "boolean":
      out.push(v ? "true" : "false");
      return;
    case "number":
      if (!Number.isFinite(v)) throw new CanonicalizationError("Numbers must be finite.");
      // RFC 8785 section 3.2.2.3 adopts the ECMAScript Number-to-String algorithm,
      // which is what JSON.stringify uses. -0 serializes as 0.
      out.push(JSON.stringify(v));
      return;
    case "string":
      if (!v.isWellFormed())
        throw new CanonicalizationError("String contains an unpaired surrogate.");
      // RFC 8785 section 3.2.2.2 matches JSON.stringify for well-formed strings.
      out.push(JSON.stringify(v));
      return;
    case "object": {
      if (Array.isArray(v)) {
        out.push("[");
        v.forEach((item, i) => {
          if (i > 0) out.push(",");
          serialize(item, out);
        });
        out.push("]");
        return;
      }
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) {
        throw new CanonicalizationError("Only plain objects can be canonicalized.");
      }
      // RFC 8785 section 3.2.3: sort by UTF-16 code units. The default sort
      // compares UTF-16 code units, which is exactly that.
      const keys = Object.keys(v as object).sort();
      out.push("{");
      keys.forEach((k, i) => {
        const member = (v as Record<string, unknown>)[k];
        if (member === undefined) throw new CanonicalizationError(`Member "${k}" is undefined.`);
        if (i > 0) out.push(",");
        serialize(k, out);
        out.push(":");
        serialize(member, out);
      });
      out.push("}");
      return;
    }
    default:
      throw new CanonicalizationError(`Cannot canonicalize a value of type ${typeof v}.`);
  }
}

/** The RFC 8785 canonical form of a JSON value, as a string. */
export function canonicalizeToString(value: unknown): string {
  const out: string[] = [];
  serialize(value, out);
  return out.join("");
}

/** The RFC 8785 canonical form of a JSON value, as UTF-8 bytes. */
export function canonicalize(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalizeToString(value));
}
