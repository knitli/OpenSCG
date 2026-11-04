// SPDX-FileCopyrightText: 2026 Knitli Inc.
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  APPROVAL_DOMAIN,
  approvalStatementBytes,
  buildApprovalStatement,
  CanonicalizationError,
  canonicalize,
  canonicalizeToString,
  type Guide,
  parseStrict,
  payloadBytes,
  payloadDigest,
  payloadOf,
  StrictParseError,
  sha256,
} from "../src/index.js";

const vec = (dir: string) => new URL(`../conformance/vectors/${dir}/`, import.meta.url);
const bytes = (dir: string, f: string) => new Uint8Array(readFileSync(new URL(f, vec(dir))));
const text = (dir: string, f: string) => readFileSync(new URL(f, vec(dir)), "utf8");
const canon = JSON.parse(text("canonical", "manifest.json"));
const payload = JSON.parse(text("payload", "manifest.json"));
// biome-ignore lint/suspicious/noExplicitAny: manifest entries are untyped JSON
type Case = any;
const dec = new TextDecoder();

describe("canonicalization vectors", () => {
  it.each<[string, Case]>(canon.valid.map((c: Case) => [c.id, c] as [string, Case]))(
    "%s",
    (_id, c) => {
      const out = canonicalize(parseStrict(bytes("canonical", c.input)));
      expect(dec.decode(out)).toBe(dec.decode(bytes("canonical", c.expected)));
      expect(out).toEqual(bytes("canonical", c.expected));
    },
  );

  it.each<[string, Case]>(canon.invalid.map((c: Case) => [c.id, c] as [string, Case]))(
    "rejects %s",
    (_id, c) => {
      let err: unknown;
      try {
        parseStrict(bytes("canonical", c.input));
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(StrictParseError);
      expect((err as StrictParseError).code).toBe(c.error);
    },
  );

  it("canonical output is a fixed point", () => {
    for (const c of canon.valid) {
      const once = canonicalize(parseStrict(bytes("canonical", c.input)));
      expect(canonicalize(parseStrict(once))).toEqual(once);
    }
  });

  it("treats __proto__ as an ordinary member", () => {
    const v = parseStrict('{"__proto__":{"x":1},"a":2}') as Record<string, unknown>;
    expect(canonicalizeToString(v)).toBe('{"__proto__":{"x":1},"a":2}');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it("refuses values JSON cannot represent", () => {
    expect(() => canonicalize({ a: undefined })).toThrow(CanonicalizationError);
    expect(() => canonicalize([Number.NaN])).toThrow(CanonicalizationError);
    expect(() => canonicalize(["\ud800"])).toThrow(CanonicalizationError);
    expect(() => canonicalize(new Date())).toThrow(CanonicalizationError);
  });

  it("enforces the size limit", () => {
    expect(() => parseStrict("[1]", { maxBytes: 2 })).toThrow(/OSCG-P006/);
  });
});

describe("payload vectors", () => {
  it.each<[string, Case]>(payload.cases.map((c: Case) => [c.id, c] as [string, Case]))(
    "%s",
    async (_id, c) => {
      const guide = parseStrict(bytes("payload", c.guide)) as Guide & {
        authority?: { claimed_signer?: object };
      };
      expect(payloadBytes(guide)).toEqual(bytes("payload", c.payload));
      expect(await payloadDigest(guide)).toEqual(c.payload_digest);
      if (c.statement) {
        const st = approvalStatementBytes(await buildApprovalStatement(guide));
        expect(st).toEqual(bytes("payload", c.statement));
        expect(await sha256(st)).toEqual(c.statement_digest);
        expect(dec.decode(st).startsWith(APPROVAL_DOMAIN)).toBe(true);
      }
    },
  );
});

describe("payload rules", () => {
  const lantern = () =>
    parseStrict(
      readFileSync(new URL("../examples/synthetic-lantern.json", import.meta.url)),
    ) as Guide;

  it("excludes review and attestations, and only those", async () => {
    const g = lantern();
    const d1 = await payloadDigest(g);
    const withExtras = { ...g, review: { status: "complete" }, attestations: [{ x: 1 }] };
    expect(await payloadDigest(withExtras)).toEqual(d1);
    expect(Object.keys(payloadOf(withExtras)).sort()).toEqual(
      Object.keys(g)
        .filter((k) => k !== "review")
        .sort(),
    );
  });

  it("changes when any covered value changes, including extensions and member order is irrelevant", async () => {
    const g = lantern();
    const d1 = await payloadDigest(g);
    const changed = { ...g, extensions: { "org.example.x": { must_understand: false, data: 1 } } };
    expect((await payloadDigest(changed)).value).not.toBe(d1.value);
    const reordered = Object.fromEntries(Object.entries(g).reverse());
    expect(await payloadDigest(reordered)).toEqual(d1);
  });

  it("the approval statement binds guide, revision, profile and digest", async () => {
    const g = lantern() as Guide & { authority: { claimed_signer: object } };
    const s = await buildApprovalStatement(g);
    expect(s).toMatchObject({
      guide_id: g.guide_id,
      revision_id: g.revision_id,
      profile: g.profile,
      payload_digest: await payloadDigest(g),
      purpose: "approve-scg-revision",
    });
    expect(s.statement_text).toContain(s.payload_digest.value);
  });
});
