# SPDX-FileCopyrightText: 2026 Knitli Inc.
# SPDX-License-Identifier: Apache-2.0
"""RFC 8785 JSON Canonicalization Scheme, specification section 8.3."""

from __future__ import annotations

import math
from decimal import Decimal
from typing import Any


def _number(x: float | int) -> str:
    if isinstance(x, bool):
        raise TypeError("bool is not a number")
    x = float(x)
    if math.isnan(x) or math.isinf(x):
        raise ValueError("numbers must be finite")
    if x == 0:
        return "0"
    sign = "-" if x < 0 else ""
    # repr() gives the shortest digits that round-trip, as ECMAScript requires.
    t = Decimal(repr(abs(x))).as_tuple()
    digits = "".join(map(str, t.digits)).rstrip("0") or "0"
    stripped = len("".join(map(str, t.digits))) - len(digits)
    exp = int(t.exponent) + stripped
    k = len(digits)
    n = k + exp  # value = 0.digits * 10^n
    if k <= n <= 21:
        s = digits + "0" * (n - k)
    elif 0 < n <= 21:
        s = digits[:n] + "." + digits[n:]
    elif -6 < n <= 0:
        s = "0." + "0" * (-n) + digits
    else:
        e = n - 1
        mant = digits[0] + ("." + digits[1:] if k > 1 else "")
        s = f"{mant}e{'+' if e >= 0 else '-'}{abs(e)}"
    return sign + s


_ESC = {'"': '\\"', "\\": "\\\\", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t"}


def _string(s: str) -> str:
    out = ['"']
    for ch in s:
        if ch in _ESC:
            out.append(_ESC[ch])
        elif ord(ch) < 0x20:
            out.append(f"\\u{ord(ch):04x}")
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def _utf16_key(s: str) -> bytes:
    return s.encode("utf-16-be", errors="surrogatepass")


def _serialize(v: Any, out: list[str]) -> None:
    if v is None:
        out.append("null")
    elif v is True:
        out.append("true")
    elif v is False:
        out.append("false")
    elif isinstance(v, (int, float)):
        out.append(_number(v))
    elif isinstance(v, str):
        out.append(_string(v))
    elif isinstance(v, list):
        out.append("[")
        for i, x in enumerate(v):
            if i:
                out.append(",")
            _serialize(x, out)
        out.append("]")
    elif isinstance(v, dict):
        out.append("{")
        for i, k in enumerate(sorted(v, key=_utf16_key)):
            if i:
                out.append(",")
            out.append(_string(k))
            out.append(":")
            _serialize(v[k], out)
        out.append("}")
    else:
        raise TypeError(f"cannot canonicalize {type(v).__name__}")


def canonicalize(v: Any) -> bytes:
    out: list[str] = []
    _serialize(v, out)
    return "".join(out).encode("utf-8")
