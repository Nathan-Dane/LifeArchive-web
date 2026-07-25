# Core boundary

The web frontend is a presentation edge. Durable behaviour is owned by the
compiled LifeArchive runtime. This document defines the one permitted direction
of dependency and the rules that keep it intact.

## Required direction

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

Every arrow points one way. Nothing below a layer reaches up, and no layer is
bypassed. React feature code has exactly one way to reach durable state:
`LifeArchiveClient`.

Layer responsibilities:

| Layer | Owns |
|---|---|
| React feature code | Rendering, local UI state, editor buffers, debounce, focus, navigation state, accessibility, localisation. |
| `LifeArchiveClient` | The ergonomic public API: named, coarse, versioned operations returning ergonomic values. |
| Worker transport | Serialisation, request/response correlation, cancellation, keeping the runtime off the main thread. |
| Compiled Wasm runtime | The delivery vehicle for the Rust product service. |
| Rust product service | Domain validation, civil-date semantics, time navigation, queries, revisions, migrations, media byte ownership, archive format, atomicity. |

## Rules

### React never owns durable behaviour

- **React components never call SQL.** No statements, no query builders, no
  parameterised strings, no exceptions for "just a read".
- **React components never know SQLite schemas.** Table names, column names,
  indexes, and schema versions do not appear in this repository's source.
- **React components never implement migrations.** Schema evolution belongs to
  the runtime. The frontend negotiates a version; it does not upgrade a store.
- **React components never reconstruct Record or Timeline aggregates.** The
  core returns bounded, snapshot-consistent projections with their ordering,
  counts, coverage, and invalidation token already decided. The frontend
  renders them. It does not join, deduplicate, re-sort, re-window, or
  re-aggregate them, and it does not issue one query per row.

### Storage

- **Archive content never uses `localStorage`.** Not entries, not writing, not
  Events, Spans, Tracks, tags, media, drafts, or archive metadata.
  `localStorage` is synchronous, small, string-only, and silently evictable —
  it is not archive storage, and using it as one would be a durability lie.
  Archive bytes live where the runtime puts them.
- **Presentation preferences may use browser preference storage.** Appearance,
  drawer state, last selected scale, and similar device-local UI choices are
  fine in `localStorage` or an equivalent. They are never exported, never part
  of an archive, and never load-bearing for archive content.

### Communication with the core

- **Mutations use expected revisions.** Every write carries the revision the
  caller believes it is modifying. A conflict returns enough current state for
  the frontend to preserve and present the user's unsaved buffer.
- **Core communication uses coarse, versioned operations.** One named
  product-level operation per user-meaningful action — not fine-grained CRUD,
  not a generic "execute" escape hatch, not a raw store handle. Chatty
  per-row traffic across the boundary is a design defect.
- **Generated runtime types remain beneath an ergonomic public client.**
  Wire DTOs, generated bindings, and transport envelopes are internal to the
  client module. Feature code imports ergonomic values only. A generated type
  appearing in a component's props is a boundary violation.

### Mocks

- **A mock client may exist only behind the same interface.** It implements
  `LifeArchiveClient` exactly, so features cannot tell the difference and
  cannot grow a mock-only path. A mock may return fixed values or record calls;
  it must not reimplement Rust-owned policy — no date arithmetic, no conflict
  resolution, no aggregation, no archive encoding. A mock that *computes* a
  core-owned answer will drift from the real one and is worse than no mock.
- **Mock persistence is development-only.** It is for local development, tests,
  and previews. It never persists anything a user could mistake for an archive.
- **Production must fail clearly when the runtime is absent.** A production
  build with no runtime shows an explicit, honest unavailable state. It does
  not degrade quietly, does not present an empty archive, and does not offer
  writing surfaces that will not persist.
- **Production must never silently fall back to mock content.** There is no
  automatic mock fallback in a production build under any condition. Selecting
  the mock is an explicit development-mode decision, visible in the UI.

### Repository hygiene

- **No private contracts or Rust source enter the public repository.** Contract
  specifications, schemas, fixtures, operation vectors, and Rust code stay
  private. What crosses the boundary is a compiled, versioned artifact plus its
  public type surface. See
  [`repository-boundary.md`](repository-boundary.md).

## Boundary test

When adding behaviour, ask:

1. Must every LifeArchive client produce the same durable result? Then it
   belongs in Rust, behind a versioned operation — not here.
2. Is it rendering, input, focus, formatting, permission, or lifecycle? Then it
   is frontend work.
3. Is this code only mapping versioned values into ergonomic ones? That is the
   client's job and is fine — as long as it chooses nothing.
4. Does it open a low-level bypass? Then extend the coarse operation instead.
