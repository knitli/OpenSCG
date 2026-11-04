# SPDX-FileCopyrightText: 2026 Knitli Inc.
# SPDX-License-Identifier: Apache-2.0
"""Strict JSON parsing, specification section 8.2."""

from __future__ import annotations

import json
import re
from typing import Any

MAX_BYTES = 16 * 1024 * 1024
MAX_DEPTH = 64
_EXACT = 2**53 - 1


class StrictParseError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code


def _pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in pairs:
        if k in out:
            raise StrictParseError("OSCG-P003", f"duplicate member name {k!r}")
        out[k] = v
    return out


def _constant(name: str) -> Any:
    raise StrictParseError("OSCG-P002", f"{name} is not JSON")


def _int(text: str) -> Any:
    n = int(text)
    if abs(n) > 1.7976931348623157e308:
        raise StrictParseError("OSCG-P005", "number too large")
    if abs(n) > _EXACT and int(float(n)) != n:
        raise StrictParseError("OSCG-P005", "integer not exactly representable")
    return float(n) if abs(n) > _EXACT else n


def _float(text: str) -> float:
    f = float(text)
    if f in (float("inf"), float("-inf")):
        raise StrictParseError("OSCG-P005", "number too large")
    return f


def _depth(text: str) -> int:
    # Depth of brackets outside strings.
    depth = best = 0
    in_str = esc = False
    for ch in text:
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch in "[{":
            depth += 1
            best = max(best, depth)
        elif ch in "]}":
            depth -= 1
    return best


def _check_strings(v: Any) -> None:
    if isinstance(v, str):
        if re.search(r"[\ud800-\udfff]", v):
            raise StrictParseError("OSCG-P004", "unpaired surrogate")
    elif isinstance(v, dict):
        for k, x in v.items():
            _check_strings(k)
            _check_strings(x)
    elif isinstance(v, list):
        for x in v:
            _check_strings(x)


def parse_strict(data: bytes) -> Any:
    if len(data) > MAX_BYTES:
        raise StrictParseError("OSCG-P006", "input too large")
    if data.startswith(b"\xef\xbb\xbf"):
        raise StrictParseError("OSCG-P001", "byte-order mark")
    try:
        text = data.decode("utf-8", errors="strict")
    except UnicodeDecodeError as e:
        raise StrictParseError("OSCG-P001", "invalid UTF-8") from e
    if _depth(text) > MAX_DEPTH:
        raise StrictParseError("OSCG-P006", "nesting too deep")
    try:
        value = json.loads(
            text,
            object_pairs_hook=_pairs,
            parse_constant=_constant,
            parse_int=_int,
            parse_float=_float,
        )
    except StrictParseError:
        raise
    except json.JSONDecodeError as e:
        raise StrictParseError("OSCG-P002", str(e)) from e
    # Python decodes "😀" escape pairs into one character, and leaves a
    # lone escaped surrogate as a surrogate code point, which this catches.
    _check_strings(value)
    return value
