# LifeArchive Web

LifeArchive is a private, local-first place to record, browse, and preserve a
life across days, weeks, months, and years. It is not a social network, a
productivity dashboard, a tracker, or a notes app.

This repository is the **public web frontend**. It is a presentation edge over
a Rust-owned product service: the frontend renders and captures, while durable
domain, time, persistence, media, and archive behaviour belongs to the core.

## Status

**Scaffold.** There is no product functionality yet.

- The application shell defines routes for `/record`, `/timeline`, and
  `/settings`, and redirects `/` to `/record`. Route contents are temporary
  headings.
- **Production archive persistence is not integrated.** No runtime, no store,
  no import or export, no media.
- **The current UI must not be trusted for real archive storage.** Nothing you
  type into it is saved anywhere durable. Do not use this build for a real
  archive.

What this repository currently establishes is scope and boundaries for the work
that follows — see [Documentation](#documentation).

## Architecture

Two sibling repositories, not submodules:

- `LifeArchive/` — private and canonical: the Rust workspace, versioned
  contracts, schemas, and native platforms.
- `LifeArchive-web/` — this repository, public: the web frontend.

Only compiled, versioned runtime artifacts cross that boundary. The required
direction of dependency is one way:

```text
React feature code
    ↓
LifeArchiveClient
    ↓
worker transport
    ↓
compiled proprietary Wasm runtime
    ↓
Rust-owned product service and persistence
```

Feature code never calls SQL, never knows schemas, never runs migrations, never
rebuilds aggregates, and never stores archive content in `localStorage`.

**A public checkout builds and tests without the proprietary runtime.** The
runtime is loaded at runtime, never linked at build time. When it is absent, a
production build fails clearly instead of falling back to mock content.

## Requirements

- Node 24 LTS (pinned in `.nvmrc` / `.node-version`)
- pnpm (pinned via the `packageManager` field)

## Setup

```bash
nvm use
corepack enable pnpm
pnpm install
```

## Scripts

| Script           | Purpose                                   |
| ---------------- | ----------------------------------------- |
| `pnpm dev`       | Vite dev server                           |
| `pnpm build`     | Type-check project references, then build |
| `pnpm preview`   | Serve the production build                |
| `pnpm lint`      | ESLint                                    |
| `pnpm typecheck` | TypeScript, no emit                       |
| `pnpm test`      | Vitest, watch mode                        |
| `pnpm test:run`  | Vitest, single run                        |
| `pnpm test:e2e`  | Playwright                                |
| `pnpm check`     | lint + typecheck + tests + build          |

## Visual reference

`docs/reference/record-v0.1.0.html` is a self-contained HTML mock of the
responsive Record workspace, preserved byte-for-byte. Open it directly in a
browser.

It is a **visual and interaction reference only** — not production code, not a
persistence or domain specification. The Rust contracts and current product
documentation override it, and several things it displays are deliberately not
approved. Read [`docs/reference/README.md`](docs/reference/README.md) before
using it.

## Documentation

| Document | Read when |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Working in this repository, human or agent. |
| [`docs/product/web-v0.1.0-scope.md`](docs/product/web-v0.1.0-scope.md) | Any product work. Start here. |
| [`docs/architecture/core-boundary.md`](docs/architecture/core-boundary.md) | Data flow, client, worker, storage, state. |
| [`docs/architecture/repository-boundary.md`](docs/architecture/repository-boundary.md) | CI, licensing, private/public separation. |
| [`docs/architecture/runtime-delivery.md`](docs/architecture/runtime-delivery.md) | Runtime loading, pinning, capability negotiation. |
| [`docs/reference/README.md`](docs/reference/README.md) | Using the visual reference. |
| [`runtime/README.md`](runtime/README.md) | The runtime artifact directory. |

## Licence

The frontend source in this repository is licensed under **MPL-2.0**
([`LICENSE`](LICENSE)). The compiled LifeArchive runtime is separate
proprietary software under its own licence, and its source is not part of this
repository. A complete distribution may include both under their respective
licences; the combined application is not entirely open source. See
[`NOTICE.md`](NOTICE.md).
