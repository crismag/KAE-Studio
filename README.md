# KAE-Studio

An AI-assisted software definition and context-engineering platform.

Turn discussions, documents, customer inputs, and incomplete ideas into a complete, traceable, implementation-ready project definition — decomposed into modules, connected by explicit relationships, reviewed for gaps and conflicts — then publish module-level development context for humans and AI coding agents.

The chat is the intake mechanism. The structured project definition is the product.

```text
Understand -> Define -> Decompose -> Connect -> Review -> Approve -> Package -> Develop -> Retain changes
```

Durable knowledge, provenance, revision, and readiness come from KAE-Memory behind a versioned API boundary.

## Repository status

**The application runs in two modes, and which one you get is decided at build time.**

- [docs/](docs/) — the governing product and architecture definition. See [docs/README.md](docs/README.md) and [CLAUDE.md](CLAUDE.md).
- `src/services/mock/` — deterministic mock adapters. Contacts nothing. This is what a build with no `VITE_STUDIO_API` produces, and what [PROTOTYPE_NOTES.md](PROTOTYPE_NOTES.md) describes.
- `src/services/live/` — the live adapters, talking to a **trusted Studio backend** (`backend/`) that holds the KAE-Memory credential. The browser never holds one.

**`VITE_STUDIO_API` is a build-time constant, not a runtime setting.** Unset, the bundler eliminates the live branch entirely and ships a mock-mode application — which is exactly what once reached production looking like a successful deploy. The deploy script therefore sets it explicitly and refuses to ship a bundle containing `createMockServices`.

## Running it

```bash
npm install
npm run dev                                  # http://localhost:5173, mock mode
VITE_STUDIO_API=/studio npm run build        # live mode; static output in dist/
npm run build                                # mock mode — deliberate, and it will say so
npm test                                     # unit and component tests
npm run lint
npm run typecheck
npm run test:e2e                             # Playwright, against a fixed project roster
```

Uses hash routing and a relative base so `dist/` works from any directory without server rewrite rules.

The status bar reports which mode is running rather than asserting one. A mock build says so on screen; a live build reports the backend it reached and what it could not.

## The browser suite creates nothing permanent

End-to-end tests use a **fixed roster** of four projects — `ZZ automated test — main`, `— left`, `— right`, `— recovery` — rather than a fresh project per run. A run reuses its slot and a teardown clears it.

This is not tidiness. A per-run project name meant every CI run left a project behind, and the shared Memory instance reached 101 projects before anyone noticed. A fixed roster cannot accumulate.
