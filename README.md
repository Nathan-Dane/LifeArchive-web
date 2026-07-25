# LifeArchive Web

Public frontend repository for LifeArchive. This currently contains only the
repository scaffold and development toolchain — no product features.

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

## Status

The application shell defines routes for `/record`, `/timeline` and `/settings`,
and redirects `/` to `/record`. Route contents are temporary headings. No
storage, persistence, or production runtime is wired up.
