# SPDX-FileCopyrightText: 2026 Knitli Inc.
# SPDX-License-Identifier: Apache-2.0
"""Runs this consumer against the published conformance materials (spec/conformance.md)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from openscg_consumer.attest import (
    build_statement,
    load_pem,
    parse_time,
    payload_bytes,
    payload_digest,
    statement_bytes,
    verify,
)
from openscg_consumer.jcs import canonicalize
from openscg_consumer.strict import StrictParseError, parse_strict
from openscg_consumer.validate import (
    approval_ready,
    load_schema,
    semantic,
    structurally_valid,
    unsupported_version,
)

REPO = Path(__file__).resolve().parents[3]
CONF = REPO / "conformance"
VEC = CONF / "vectors"
VALIDATOR = load_schema(REPO)


def manifest(path: Path) -> dict:
    return json.loads(path.read_text("utf-8"))


CASES = manifest(CONF / "manifest.json")["cases"]
CANON = manifest(VEC / "canonical/manifest.json")
PAYLOAD = manifest(VEC / "payload/manifest.json")
ATTEST = manifest(VEC / "attestation/manifest.json")


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_validation_case(case: dict) -> None:
    data = (CONF / case["file"]).read_bytes()
    exp = case["expected"]
    if "parse_error" in exp:
        with pytest.raises(StrictParseError) as e:
            parse_strict(data)
        assert e.value.code == exp["parse_error"]
        return
    doc = parse_strict(data)
    version = unsupported_version(doc)
    if version:
        got = [{"code": f.code, "pointer": f.pointer} for f in version]
        assert got == exp["findings"]
        assert exp["approval_ready"] is False
        return
    valid = structurally_valid(VALIDATOR, doc)
    assert ("valid" if valid else "invalid") == exp["structure"]
    if not valid:
        assert exp["approval_ready"] is False
        return
    findings = semantic(doc)
    assert approval_ready(findings) == exp["approval_ready"]
    if "findings" in exp:
        got = sorted(
            ({"code": f.code, "pointer": f.pointer} for f in findings),
            key=lambda f: f["code"] + f["pointer"],
        )
        assert got == exp["findings"]


@pytest.mark.parametrize("case", CANON["valid"], ids=[c["id"] for c in CANON["valid"]])
def test_canonical(case: dict) -> None:
    value = parse_strict((VEC / "canonical" / case["input"]).read_bytes())
    assert canonicalize(value) == (VEC / "canonical" / case["expected"]).read_bytes()


@pytest.mark.parametrize("case", CANON["invalid"], ids=[c["id"] for c in CANON["invalid"]])
def test_strict_rejects(case: dict) -> None:
    with pytest.raises(StrictParseError) as e:
        parse_strict((VEC / "canonical" / case["input"]).read_bytes())
    assert e.value.code == case["error"]


@pytest.mark.parametrize("case", PAYLOAD["cases"], ids=[c["id"] for c in PAYLOAD["cases"]])
def test_payload(case: dict) -> None:
    base = VEC / "payload"
    guide = parse_strict((base / case["guide"]).read_bytes())
    assert payload_bytes(guide) == (base / case["payload"]).read_bytes()
    assert payload_digest(guide) == case["payload_digest"]
    if "statement" in case:
        assert statement_bytes(build_statement(guide)) == (base / case["statement"]).read_bytes()


@pytest.mark.parametrize("case", ATTEST["cases"], ids=[c["id"] for c in ATTEST["cases"]])
def test_attestation(case: dict) -> None:
    base = VEC / "attestation"
    guide = parse_strict((base / case["guide"]).read_bytes())
    report = verify(
        guide,
        guide["attestations"][0],
        anchors=[d for f in case["trust_anchors"] for d in load_pem(base / f, "CERTIFICATE")],
        crls=[d for f in case["crls"] for d in load_pem(base / f, "X509 CRL")],
        at=parse_time(ATTEST["verify_at"]),
        unknown_revocation=case.get("unknown_revocation", "fail"),
    )
    assert {k: report[k] for k in case["expected"]} == case["expected"]
