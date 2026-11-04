# SPDX-FileCopyrightText: 2026 Knitli Inc.
# SPDX-License-Identifier: Apache-2.0
"""Payload digest (section 8), approval statements and attestation checks (section 9).

CMS signature, path and CRL checks are done by the OpenSSL command-line tool.
ASN.1 is read with asn1crypto. Nothing here builds or parses DER by hand.
"""

from __future__ import annotations

import base64
import hashlib
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from asn1crypto import cms, pem, x509
from asn1crypto import crl as crl_mod

from .jcs import canonicalize

EXCLUDED = ("attestations", "review")
APPROVAL_DOMAIN = b"OpenSCG-Approval-Statement-v1\n"
DIGESTS = {"sha256", "sha384", "sha512"}
SIGNATURES = {
    "sha256_ecdsa",
    "sha384_ecdsa",
    "sha512_ecdsa",
    "rsassa_pkcs1v15",
    "rsassa_pss",
    "sha256_rsa",
    "sha384_rsa",
    "sha512_rsa",
}


def payload_bytes(guide: dict[str, Any]) -> bytes:
    return canonicalize({k: v for k, v in guide.items() if k not in EXCLUDED})


def payload_digest(guide: dict[str, Any]) -> dict[str, str]:
    return {"alg": "sha-256", "value": hashlib.sha256(payload_bytes(guide)).hexdigest()}


def statement_text(guide: dict[str, Any], digest: str) -> str:
    return (
        f"I approve revision {guide['revision_id']} of the security classification guide "
        f'"{guide["title"]}" ({guide["guide_id"]}), whose OpenSCG payload has SHA-256 digest '
        f"{digest}. This approval covers exactly that content."
    )


def build_statement(guide: dict[str, Any]) -> dict[str, Any]:
    d = payload_digest(guide)
    return {
        "type": "openscg-approval-statement",
        "version": 1,
        "purpose": "approve-scg-revision",
        "guide_id": guide["guide_id"],
        "revision_id": guide["revision_id"],
        "schema_version": guide["schema_version"],
        "profile": guide["profile"],
        "payload_format": "openscg-payload-v1",
        "payload_digest": d,
        "signer": dict(guide["authority"]["claimed_signer"]),
        "statement_text": statement_text(guide, d["value"]),
    }


def statement_bytes(statement: dict[str, Any]) -> bytes:
    return APPROVAL_DOMAIN + canonicalize(statement)


def _binding(guide: dict[str, Any], s: dict[str, Any]) -> str:
    d = payload_digest(guide)["value"]
    ok = (
        s.get("type") == "openscg-approval-statement"
        and s.get("version") == 1
        and s.get("purpose") == "approve-scg-revision"
        and s.get("payload_format") == "openscg-payload-v1"
        and all(
            s.get(k) == guide.get(k)
            for k in ("guide_id", "revision_id", "schema_version", "profile")
        )
        and s.get("payload_digest") == {"alg": "sha-256", "value": d}
        and s.get("statement_text") == statement_text(guide, d)
    )
    return "ok" if ok else "mismatch"


def _openssl_verify(sig: Path, data: Path, ca: Path, at: datetime, extra: list[str]) -> str:
    cmd = [
        "openssl",
        "cms",
        "-verify",
        "-binary",
        "-inform",
        "DER",
        "-in",
        str(sig),
        "-content",
        str(data),
        "-CAfile",
        str(ca),
        "-purpose",
        "any",
        "-attime",
        str(int(at.timestamp())),
        "-out",
        "/dev/null",
        *extra,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return "ok" if r.returncode == 0 else (r.stderr or r.stdout)


def _revocation(
    cert: x509.Certificate, anchors: list[bytes], crls: list[bytes], at: datetime, tmp: Path
) -> str:
    """Status of the signer certificate from CRLs signed by its issuer (spec 9.4).

    This consumer handles a path of signer -> trust anchor, which is what the
    published vectors use. A path with intermediates would repeat this per link.
    """
    issuers = [a for a in anchors if x509.Certificate.load(a).subject == cert.issuer]
    for raw in crls:
        crl = crl_mod.CertificateList.load(raw)
        tbs = crl["tbs_cert_list"]
        if tbs["issuer"] != cert.issuer:
            continue
        signed_by_issuer = False
        for issuer in issuers:
            (tmp / "crl.der").write_bytes(raw)
            (tmp / "issuer.pem").write_bytes(pem.armor("CERTIFICATE", issuer))
            r = subprocess.run(
                [
                    "openssl",
                    "crl",
                    "-inform",
                    "DER",
                    "-in",
                    str(tmp / "crl.der"),
                    "-CAfile",
                    str(tmp / "issuer.pem"),
                    "-noout",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            if r.returncode == 0 and "verify OK" in (r.stdout + r.stderr):
                signed_by_issuer = True
        if not signed_by_issuer:
            continue
        this_update = tbs["this_update"].native
        next_update = tbs["next_update"].native
        if this_update > at or (next_update is not None and next_update < at):
            continue  # not current: cannot establish status from it
        revoked = {r["user_certificate"].native for r in tbs["revoked_certificates"]}
        return "revoked" if cert.serial_number in revoked else "good"
    return "unknown"


def verify(
    guide: dict[str, Any],
    att: dict[str, Any],
    anchors: list[bytes],
    crls: list[bytes],
    at: datetime,
    unknown_revocation: str = "fail",
) -> dict[str, Any]:
    report: dict[str, Any] = {
        "binding": _binding(guide, att["statement"])
        if att.get("format") == "openscg-cms-detached-v1"
        else "mismatch",
        "authority": {"complete": "review_complete", "rejected": "review_rejected"}.get(
            (guide.get("review") or {}).get("status"), "not_verified"
        ),
    }
    der = base64.b64decode(att["signature"], validate=True)
    info = cms.ContentInfo.load(der)
    sd = info["content"]
    signer_info = sd["signer_infos"][0]
    sid = signer_info["sid"].chosen
    cert = next(
        c.chosen
        for c in sd["certificates"]
        if c.chosen.issuer == sid["issuer"]
        and c.chosen.serial_number == sid["serial_number"].native
    )
    digest_alg = signer_info["digest_algorithm"]["algorithm"].native
    sig_alg = signer_info["signature_algorithm"].signature_algo
    sig_alg_name = signer_info["signature_algorithm"]["algorithm"].native
    report["algorithm"] = (
        "permitted"
        if digest_alg in DIGESTS
        and (sig_alg_name in SIGNATURES or sig_alg in ("ecdsa", "rsassa_pss"))
        else "not_permitted"
    )
    ku = cert.key_usage_value.native if cert.key_usage_value else set()
    report["key_usage"] = "permitted" if "non_repudiation" in ku else "not_permitted"
    nb, na = (
        cert["tbs_certificate"]["validity"]["not_before"].native,
        cert["tbs_certificate"]["validity"]["not_after"].native,
    )
    report["validity"] = "not_yet_valid" if at < nb else "expired" if at > na else "ok"

    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        (t / "sig.der").write_bytes(der)
        (t / "data.bin").write_bytes(statement_bytes(att["statement"]))
        (t / "ca.pem").write_bytes(b"".join(pem.armor("CERTIFICATE", a) for a in anchors))
        sig_only = _openssl_verify(t / "sig.der", t / "data.bin", t / "ca.pem", at, ["-noverify"])
        report["signature"] = "valid" if sig_only == "ok" else "invalid"
        chain_time = at if report["validity"] == "ok" else nb + (na - nb) / 2
        (t / "signer.pem").write_bytes(pem.armor("CERTIFICATE", cert.dump()))
        others = [c.chosen.dump() for c in sd["certificates"] if c.chosen.dump() != cert.dump()]
        (t / "untrusted.pem").write_bytes(b"".join(pem.armor("CERTIFICATE", c) for c in others))
        path_cmd = [
            "openssl",
            "verify",
            "-CAfile",
            str(t / "ca.pem"),
            "-purpose",
            "any",
            "-attime",
            str(int(chain_time.timestamp())),
            str(t / "signer.pem"),
        ]
        if others:
            path_cmd[2:2] = ["-untrusted", str(t / "untrusted.pem")]
        path = subprocess.run(path_cmd, capture_output=True, text=True, check=False)
        report["trust"] = "trusted" if path.returncode == 0 else "untrusted"
        if report["trust"] != "trusted":
            report["revocation"] = "not_checked"
        else:
            report["revocation"] = _revocation(cert, anchors, crls, at, t)
    rev_ok = report["revocation"] == "good" or (
        report["revocation"] == "unknown" and unknown_revocation == "accept"
    )
    report["technically_valid"] = (
        report["binding"] == "ok"
        and report["signature"] == "valid"
        and report["algorithm"] == "permitted"
        and report["key_usage"] == "permitted"
        and report["validity"] == "ok"
        and report["trust"] == "trusted"
        and rev_ok
    )
    return report


def parse_time(text: str) -> datetime:
    return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(UTC)


def load_pem(path: Path, label: str) -> list[bytes]:
    return [der for t, _h, der in pem.unarmor(path.read_bytes(), multiple=True) if t == label]


__all__ = [
    "build_statement",
    "load_pem",
    "parse_time",
    "payload_bytes",
    "payload_digest",
    "statement_bytes",
    "verify",
    "x509",
]
