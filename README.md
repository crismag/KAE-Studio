# KAE-Studio

An AI-assisted software definition and context-engineering platform.

Turn discussions, documents, customer inputs, and incomplete ideas into a complete, traceable, implementation-ready project definition — decomposed into modules, connected by explicit relationships, reviewed for gaps and conflicts — then publish module-level development context for humans and AI coding agents.

The chat is the intake mechanism. The structured project definition is the product.

```text
Understand -> Define -> Decompose -> Connect -> Review -> Approve -> Package -> Develop -> Retain changes
```

Durable knowledge, provenance, revision, and readiness come from KAE-Memory behind a versioned API boundary.

## Repository status

**Documentation is the deliverable; the application is an experience prototype.**

- [docs/](docs/) — the governing product and architecture definition. See [docs/README.md](docs/README.md) and [CLAUDE.md](CLAUDE.md).
- `src/` — a **frontend prototype only**, backed by deterministic mock adapters. No AI provider, KAE-Memory instance, database, or publishing target is contacted. See [PROTOTYPE_NOTES.md](PROTOTYPE_NOTES.md).

## Running the prototype

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static output in dist/, deployable to shared hosting
npm test           # unit and component tests
npm run lint
npm run typecheck
```

Uses hash routing and a relative base so `dist/` works from any directory without server rewrite rules.
