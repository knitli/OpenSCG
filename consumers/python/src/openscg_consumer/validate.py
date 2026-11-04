# SPDX-FileCopyrightText: 2026 Knitli Inc.
# SPDX-License-Identifier: Apache-2.0
"""Structural (section 6) and semantic (section 7) validation."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

LEVELS = {"U": 0, "C": 1, "S": 2, "TS": 3}
KNOWN_PROFILES = {"cnsi-core", "dod-5200.45"}
SEVERITY = {
    **dict.fromkeys(
        ["V001", "V002", "V003", "V004", "V005", "V010", "V011", "V013", "V014", "V016"],
        "error",
    ),
    **dict.fromkeys(["V040", "V041", "V042", "V043", "V044", "V045", "V049", "V050"], "error"),
    **dict.fromkeys(
        ["V015", "V017", "V018", "V019", "V022", "V023", "V032", "V034", "V052"], "warning"
    ),
    **dict.fromkeys(["V030", "V031", "V033"], "unsupported"),
    **dict.fromkeys(["V020", "V021", "V046"], "policy_review"),
}
BLOCKING = {"error", "unsupported", "policy_review"}


@dataclass(frozen=True)
class Finding:
    code: str
    severity: str
    pointer: str


def _tok(t: str | int) -> str:
    return str(t).replace("~", "~0").replace("/", "~1")


def ptr(*tokens: str | int) -> str:
    return "".join("/" + _tok(t) for t in tokens)


def load_schema(repo: Path) -> Draft202012Validator:
    schema = json.loads((repo / "schema/0.1/guide.schema.json").read_text("utf-8"))
    Draft202012Validator.check_schema(schema)
    checker = FormatChecker()
    for fmt in ("date", "uri", "email"):
        if fmt not in checker.checkers:
            raise RuntimeError(f"format {fmt!r} cannot be asserted; install its checker")
    return Draft202012Validator(schema, format_checker=checker)


def structurally_valid(validator: Draft202012Validator, doc: Any) -> bool:
    return not any(True for _ in validator.iter_errors(doc))


def _max_level(e: dict[str, Any]) -> str | None:
    if "level" in e:
        return e["level"]
    if "level_range" in e:
        return e["level_range"]["highest"]
    return None


def _classified(e: dict[str, Any]) -> bool:
    m = _max_level(e)
    return m is not None and m != "U"


def semantic(
    doc: dict[str, Any], supported_extensions: frozenset[str] = frozenset()
) -> list[Finding]:
    out: list[Finding] = []

    def add(code: str, pointer: str) -> None:
        out.append(Finding("OSCG-" + code, SEVERITY[code], pointer))

    def extensions(exts: dict[str, Any] | None, base: tuple[str | int, ...]) -> None:
        for ns, ext in (exts or {}).items():
            if ns in supported_extensions:
                continue
            add("V033" if ext["must_understand"] else "V034", ptr(*base, "extensions", ns))

    profile = doc["profile"]
    if profile not in KNOWN_PROFILES:
        add("V031", "/profile")
    elif profile == "dod-5200.45":
        add("V032", "/profile")

    sections = doc.get("sections")
    section_ids: set[str] | None = None
    if sections is not None:
        section_ids = set()
        for i, s in enumerate(sections):
            if s["section_id"] in section_ids:
                add("V002", ptr("sections", i, "section_id"))
            section_ids.add(s["section_id"])

    entries = doc["entries"]
    ids: set[str] = set()
    first: dict[str, dict[str, Any]] = {}
    for i, e in enumerate(entries):
        if e["entry_id"] in ids:
            add("V001", ptr("entries", i, "entry_id"))
        else:
            first[e["entry_id"]] = e
        ids.add(e["entry_id"])
    if not entries:
        add("V011", "/entries")

    issued = (doc.get("dates") or {}).get("issued")
    for i, e in enumerate(entries):
        at = lambda *t, i=i: ptr("entries", i, *t)  # noqa: E731
        if "section_id" in e and (section_ids is None or e["section_id"] not in section_ids):
            add("V004", at("section_id"))
        for j, r in enumerate(e.get("references", [])):
            if r == e["entry_id"]:
                add("V005", at("references", j))
            elif r not in ids:
                add("V003", at("references", j))
        aea = e.get("regime") == "aea"
        if aea:
            add("V030", at("regime"))
        rng = e.get("level_range")
        if rng:
            if LEVELS[rng["lowest"]] > LEVELS[rng["highest"]]:
                add("V014", at("level_range"))
            elif rng["lowest"] == rng["highest"]:
                add("V015", at("level_range"))
        if _classified(e) and not aea:
            if "reason" not in e:
                add("V010", at("reason"))
            if "declassification" not in e:
                add("V013", at("declassification"))
        if not _classified(e) and ("reason" in e or "declassification" in e):
            add("V019", at("reason" if "reason" in e else "declassification"))
        d = e.get("declassification") or {}
        if d.get("kind") == "exemption":
            if "authority" not in d:
                add("V020", at("declassification", "authority"))
            if d.get("code") in ("50X1-HUM", "50X2-WMD"):
                add("V021", at("declassification", "code"))
            if "until_date" in d and "until_event_text" in d:
                add("V022", at("declassification"))
        if d.get("kind") == "date" and issued and d["date"] <= issued:
            add("V023", at("declassification", "date"))
        if e["kind"] == "compilation":
            if "condition_text" not in e:
                add("V016", at("condition_text"))
            refs = e.get("references", [])
            if len(refs) < 2:
                add("V017", at("references"))
            top = _max_level(e)
            parts = [first[r] for r in refs if r in first]
            if top and parts:
                highest_part = max(LEVELS[_max_level(p) or "U"] for p in parts)
                if LEVELS[top] <= highest_part:
                    add("V018", at("level" if "level" in e else "level_range"))
        extensions(e.get("extensions"), ("entries", i))

    if "subject" not in doc:
        add("V040", "/subject")
    if "oca" not in doc:
        add("V041", "/oca")
    if "point_of_contact" not in doc:
        add("V042", "/point_of_contact")
    dates = doc.get("dates") or {}
    if "issued" not in dates and "last_reviewed" not in dates:
        add("V043", "/dates")
    dm = doc["document_markings"]
    if "banner" not in dm:
        add("V044", "/document_markings/banner")
    if dm["classification"] != "U" and "classification_authority_block" not in dm:
        add("V045", "/document_markings/classification_authority_block")
    if (dm.get("review") or {}).get("status") != "complete":
        add("V046", "/document_markings/review")

    levels = [m for m in (_max_level(e) for e in entries) if m]
    highest = max(levels, key=lambda lv: LEVELS[lv], default="U")
    if highest != "U":
        oca = doc.get("oca")
        if oca is not None:
            if "highest_level" not in oca:
                add("V052", "/oca/highest_level")
            elif LEVELS[oca["highest_level"]] < LEVELS[highest]:
                add("V049", "/oca/highest_level")
        delegated = ((doc.get("authority") or {}).get("claimed_delegation") or {}).get(
            "highest_level"
        )
        if delegated and LEVELS[delegated] < LEVELS[highest]:
            add("V050", "/authority/claimed_delegation/highest_level")

    extensions(doc.get("extensions"), ())
    return out


def approval_ready(findings: list[Finding]) -> bool:
    return not any(f.severity in BLOCKING for f in findings)
