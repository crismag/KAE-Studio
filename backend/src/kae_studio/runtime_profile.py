"""What this deployment is allowed to reach, in one word (`ADR-0006` §1, §4).

Studio has one provider choice — which model answers an interview turn,
`KAE_CIE_PROVIDER` — and it answers *which adapter runs*, never *what may this
deployment reach*. Until something answers the second question, offline is
inferred from an absent credential rather than enforced.

``KAE_RUNTIME_PROFILE`` is that answer, and it **constrains rather than
chooses** (`D-172`). A profile that supplied providers would decide which model
conducted an interview from a word about the deployment; `KAE_CIE_PROVIDER`
stays the only thing that picks, and the profile refuses what the deployment may
not reach.

The dimension is **reach**, not vendor, because ``OLLAMA_URL`` pointed at
another machine is a network call wearing the local provider's name.

**This is a second definition of KAE-Memory's vocabulary** (`runtime_profile.py`
there), copied because the two repositories share no library and will not gain
one for four constants. The tests below assert the four profile names and the
four reaches literally, so a change on this side shows up as a change rather
than as a suite that still passes (`D-174`).
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from enum import StrEnum
from ipaddress import ip_address
from urllib.parse import urlsplit

VARIABLE = "KAE_RUNTIME_PROFILE"

OFFLINE = "offline"
LOCAL = "local"
HYBRID = "hybrid"
PRODUCTION = "production"


class Reach(StrEnum):
    """What building and calling a provider touches."""

    IN_PROCESS = "in_process"
    """A fixture computed here. No socket, no credential, and no meaning.

    Studio has no such provider today. The member is kept because the table
    below is the estate's and not this repository's: without it `hybrid` and
    `production` would permit the same set here, and two profiles that mean the
    same thing are a word with no consequence (`D-174`).
    """

    HOST = "host"
    """A model on this machine, over loopback."""

    NETWORK = "network"
    """The same local adapter, pointed at another machine."""

    HOSTED = "hosted"
    """A remote API belonging to somebody else, billed per call."""


_PERMITTED: Mapping[str, frozenset[Reach]] = {
    OFFLINE: frozenset({Reach.IN_PROCESS, Reach.HOST}),
    LOCAL: frozenset({Reach.IN_PROCESS, Reach.HOST, Reach.NETWORK}),
    HYBRID: frozenset(Reach),
    # `in_process` is absent on purpose. A deterministic stand-in reports as
    # though it worked, so a production deployment running on one is the failure
    # this module exists to refuse rather than a lesser configuration to allow.
    PRODUCTION: frozenset({Reach.HOST, Reach.NETWORK, Reach.HOSTED}),
}

PROFILES = tuple(_PERMITTED)


class ProfileViolation(RuntimeError):
    """The provider can be built; this deployment may not reach it.

    Knows nothing about CIE on purpose, so this module imports no `cie_slim` and
    its tests run in a pipeline that has no checkout of one (`AUD-033`).
    `interviewer.reasoner_for` is what turns it into an unavailable interviewer.
    """


def profile_name(environ: Mapping[str, str] | None = None) -> str | None:
    """Return the declared profile, or ``None`` when nothing declares one.

    Unset is unconstrained. Defaulting to ``local`` would change what an
    existing deployment may reach without anybody deciding, and deployment
    posture is the owner's (`D-172`).
    """

    environ = os.environ if environ is None else environ
    value = environ.get(VARIABLE, "").strip().lower()
    if not value:
        return None
    if value not in _PERMITTED:
        raise ProfileViolation(f"unknown {VARIABLE}={value!r}. Valid: {', '.join(PROFILES)}")
    return value


def permits(profile: str | None, reach: Reach) -> bool:
    """Return whether ``profile`` allows a provider with this reach."""

    if profile is None:
        return True
    return reach in _PERMITTED[profile]


def reach_of_url(url: str) -> Reach:
    """Return whether ``url`` stays on this machine.

    A hostname that does not resolve to a literal loopback address is treated as
    the network. Guessing in the other direction would let ``offline`` pass a
    call that leaves the host, which is the one mistake this cannot make.
    """

    host = urlsplit(url).hostname or ""
    if host == "localhost":
        return Reach.HOST
    try:
        return Reach.HOST if ip_address(host).is_loopback else Reach.NETWORK
    except ValueError:
        return Reach.NETWORK


def require(
    reach: Reach,
    *,
    variable: str,
    value: str,
    environ: Mapping[str, str] | None = None,
) -> None:
    """Refuse a provider this deployment's profile does not permit."""

    profile = profile_name(environ)
    if permits(profile, reach):
        return
    permitted = ", ".join(sorted(member.value for member in _PERMITTED[str(profile)]))
    raise ProfileViolation(
        f"{VARIABLE}={profile} does not permit {variable}={value!r}, which "
        f"reaches {reach.value}. This profile permits: {permitted}."
    )


__all__ = [
    "HYBRID",
    "LOCAL",
    "OFFLINE",
    "PRODUCTION",
    "PROFILES",
    "VARIABLE",
    "ProfileViolation",
    "Reach",
    "permits",
    "profile_name",
    "reach_of_url",
    "require",
]
