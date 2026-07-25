# Agent instructions

This file is for coding agents working in the public LifeArchive Web
repository. Keep context small: read what the task needs, not the whole tree.

---

## First step

Read [`docs/product/web-v0.1.0-scope.md`](docs/product/web-v0.1.0-scope.md)
before doing product work. It states what is required, what the visual
reference merely illustrates, what is explicitly not approved, and what is
deferred.

Then read **only the architecture documents your task touches**:

| Read | When |
|---|---|
| [`docs/architecture/core-boundary.md`](docs/architecture/core-boundary.md) | Touching data flow, the client, the worker, storage, or state. |
| [`docs/architecture/repository-boundary.md`](docs/architecture/repository-boundary.md) | Touching CI, licensing, or anything that references the private repository. |
| [`docs/architecture/runtime-delivery.md`](docs/architecture/runtime-delivery.md) | Touching runtime loading, version pinning, capability negotiation, or `runtime/`. |

Do not read all three by default.

---

## Boundaries you must not cross

- **The HTML in `docs/reference/` is a visual reference only.** Use it for
  layout, hierarchy, spacing, tokens, and interaction feel. Do not copy,
  import, extract, or port its markup, CSS, or script into components, and do
  not treat what it displays as approved product behaviour. Never modify it —
  it must stay byte-identical for later comparison.
- **Keep the public and private repositories separate.** They are siblings, not
  submodules. Do not add a build or CI dependency from this repository to the
  private one.
- **Never copy private source or documentation into public Git.** No Rust
  source, SQLite schemas, migration SQL, contract specifications, fixtures, or
  operation vectors — not as files, not as comments, not as test data, not as
  paraphrase detailed enough to reconstruct them, not in commit messages.
- **Never implement production archive persistence in TypeScript.** No SQL, no
  schema knowledge, no migrations, no aggregate reconstruction, no calendar or
  span arithmetic, no conflict-resolution policy. That behaviour is Rust-owned.
- **Never use `localStorage` for archive content.** Not entries, writing,
  Events, Spans, Tracks, tags, media, drafts, or archive metadata. Presentation
  preferences (appearance, drawer state) may use it.
- **Keep core communication behind `LifeArchiveClient`.** Feature code has one
  door to durable state. Generated runtime types and transport envelopes stay
  inside the client module and never appear in component props. A mock may
  exist only behind the same interface, development-only, and production must
  fail clearly rather than fall back to it.

---

## How to build

- **Preserve user writing through failures.** A failed or conflicting save
  keeps the buffer and surfaces a quiet, actionable state with a retry. Never
  silently discard or overwrite writing. Never claim data is saved or stored
  locally unless real runtime state says so.
- **Avoid hard-coded user-facing copy.** Every visible or screen-reader-readable
  string goes through the localisation surface, not a string literal in a
  component.
- **Maintain accessibility and responsive behaviour.** Keyboard reachability
  and visible focus, correct roles and expanded/pressed state, no
  colour-as-only-cue, honour `prefers-reduced-motion`, and keep the documented
  responsive breakpoints working.
- **Keep steps focused and reviewable.** One coherent change per step. Do not
  mix refactors with features, do not rewrite unrelated areas, and do not
  introduce a new abstraction layer for a small task.
- **Do not add speculative scope.** No placeholder settings, dormant network or
  cloud dependencies, or scaffolding for deferred features.
- **Do not remove or weaken tests to make a change pass.** Leave the repository
  building.

---

## Before finishing

Run the narrowest relevant checks, and `pnpm check` before declaring a step
complete:

```bash
pnpm check
```

Then report, concisely:

- **files** created or changed;
- **behaviour** added or changed;
- **tests** and checks run, with real results — if something failed, say so;
- **limitations** and anything intentionally left out;
- **remaining work** and TODOs deliberately left behind.
