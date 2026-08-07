"""KAE-Studio's trusted application boundary.

The browser talks to this; this talks to KAE-Memory. That indirection is the
whole point: a Memory bearer token grants access to every project it can read,
and a token in a browser is a token in a bookmarklet, an extension, and a
screenshot.

**Studio owns no durable project state** (ADR-0006). Nothing here writes to a
database or caches project truth. What it owns is the user session, the
credential, and the shape of what a browser is allowed to ask for.
"""

__version__ = "0.1.0"
