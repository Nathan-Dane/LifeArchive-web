# LifeArchive Web — v0.1.0 product scope

This is the first document to read before doing product work in this
repository. It states what the web frontend is for, what the visual reference
merely illustrates, what is explicitly not approved, and what is deferred.

LifeArchive is a private, local-first place to record, browse, and preserve a
life across days, weeks, months, and years. The web frontend is a presentation
edge over a Rust-owned product service. It does not own domain rules, time
rules, persistence, or archive format behaviour.

Authority order when documents disagree:

1. the current Rust contracts and product documentation (private repository);
2. the architecture documents in [`docs/architecture/`](../architecture/);
3. this scope document;
4. the visual reference in [`docs/reference/`](../reference/).

---

## 1. Required product behaviour

These are the behaviours a v0.1.0 web release must deliver. Each one is a
product requirement, not a UI sketch.

### Archive lifecycle

- **Create a local archive.** The user can create a new, empty local archive
  from the browser without an account, network, or cloud service.
- **Import a `.lifearchive`.** The user can import an existing `.lifearchive`
  package. Import is validated and atomic: it either merges or leaves the prior
  state intact. Duplicate stable IDs are skipped rather than overwritten.
- **Reopen the same local archive** after a page reload *and* after a full
  browser restart, without re-selecting or re-importing it.
- **Truthful local-storage and persistence status.** Every statement the UI
  makes about where data lives and whether it is written is derived from actual
  runtime state. Never a decoration, never a constant.

### Time navigation

- **Day, Week, Month, and Year navigation.** These are the navigation scales.
  Containment, traversal, and bounded windows come from the core; the browser
  does not compute them.
- **Ordinary entries** at each of those scales.

### Structured records

- **Events and Spans addressed by stable ID.** An Event is one Gregorian civil
  date; a Span is a named inclusive civil-date range. They are selected as
  distinct objects, loaded and mutated by stable ID, never reconstructed from
  a list position or a date guess.
- **Tracks.** Optional membership of an Event or Span in a Track.
- **Ongoing Spans**, *where the current contracts support them* — an ongoing
  Span has a start and an absent end, and the absent end is genuine archive
  data presented as Present. No derived compatibility interval is ever shown
  as a product end date.
- **Boundary markers**, *where the current contracts support them* — a Span's
  begin/end marker configuration is enabled state plus an optional exact title
  override. Markers are derived presentations of the Span, not separate
  records with their own identity or writing.

### Writing safety

- **Revision-safe autosave.** Mutations carry an expected revision. The editor
  buffer updates immediately; saves are debounced and flushed before
  navigation and lifecycle transitions.
- **Preservation of unsaved writing after conflicts or failures.** A failed or
  conflicting save must keep the user's buffer and surface a quiet, actionable
  state with a retry choice. Writing is never silently discarded or
  overwritten.

### Media, portability, safety

- **Durable media.** Media is durable only after its bytes are copied into
  archive-owned storage by the core. A picker handle or object URL is an
  acquisition input, never the durable source.
- **Export** of a self-contained `.lifearchive` including original media bytes.
- **Verification** — a read-only integrity check of an archive that does not
  imply backup or sync.
- **Deliberate archive deletion** — an explicit, confirmed erase that leaves a
  usable empty archive and does not touch previously written exports.

### Browsing

- **A bounded read-only Timeline.** One bounded, snapshot-consistent window per
  request. Timeline browses and inspects; it never edits, imports, or deletes.
  Its only handoff to Record is an explicit open/edit action carrying the exact
  object ID.

### Delivery

- **Offline operation after installation.** After install, capture, browsing,
  import, and export work with no network.
- **Self-hostable delivery.** The application can be served from the user's own
  static hosting; it must not require a first-party service to function.

---

## 2. Visual-reference behaviour

These come from [`docs/reference/record-v0.1.0.html`](../reference/record-v0.1.0.html).
They describe *how the approved behaviour should look and feel*. They are
design intent, not new product capability, and they never justify storing or
claiming anything the core does not support.

- **Desktop Record workspace** — a three-region layout: time/object navigation,
  the writing surface, and object details.
- **Responsive navigation drawer** — below the wide breakpoint the navigation
  region becomes an on-demand drawer with a backdrop, toggled from the top bar.
- **Responsive details drawer** — the details region becomes an on-demand
  drawer at a wider breakpoint than the navigation drawer, so the two collapse
  in stages rather than at once. Opening one closes the other.
- **Expandable calendar** — a week strip that expands to the surrounding month
  and collapses back, with the toggle carrying correct expanded state.
- **Dark and light appearance** — dark is the home appearance; light retains the
  archival character. Both are fully specified token sets, not one derived from
  the other.
- **Record/editor/details hierarchy** — the writing surface is visually primary;
  metadata is compact and secondary; destructive actions sit at the bottom of
  the selected object's own surface.
- **Saving and conflict statuses** — one place per Record surface reports save
  state, in the header line beside the object type.
- **Tablet and mobile adaptations** — progressive collapse of the top bar,
  wrapping primary navigation, icon-only actions, single-column media, and
  reduced padding at the narrow breakpoints.
- **Keyboard and reduced-motion behaviour** — visible focus outlines on all
  interactive controls, Escape closing open drawers and the expanded calendar,
  and honouring `prefers-reduced-motion`.

---

## 3. Not approved merely because it appears in the demo

The reference shows these. **Showing them is not approval.** Do not build them
in v0.1.0 without an explicit contract change first.

- **People.** No durable model, schema, or archive record exists. The demo's
  People card is a placeholder.
- **Places.** Same — no durable model, schema, or archive record.
- **Related scales.** The "3 connected records" card implies a relationship
  graph that does not exist in any contract.
- **Multiple tags shown as equal peers.** Tags are stable semantic IDs. Where
  the current Rust contract supports an ordered collection, it also designates
  a single *display* tag, and compact presentation uses that one colour only.
  Rendering several equally weighted colour chips in a compact surface is not
  approved, and any tag support at all must match the contract the integrated
  runtime actually exposes — not this document and not the demo. Colour is
  never the sole cue; a tag always appears with its name or an equivalent.
- **HTML as the durable writing format.** The demo's rich-text toolbar implies
  a `contenteditable` HTML document. Durable writing is Markdown. A rich
  editing surface may exist, but what is stored is Markdown, and round-trip
  fidelity of the stored bytes is a requirement.
- **Static "Saved" claims.** The demo hard-codes `Saved`. Save status must be
  derived from a real mutation result, and must be able to express saving,
  saved, failed, and conflicted.
- **Static "Stored on this device" claims.** The demo hard-codes a green local
  indicator. Storage status must be derived from a real runtime and real
  storage state, and must be able to express that no archive is open or that
  storage is unavailable. Implying durable local storage that does not exist is
  a data-safety defect, not a copy detail.
- **Direct React access to OPFS, SQLite, or IndexedDB.** Feature code does not
  touch browser storage APIs for archive content. See
  [`docs/architecture/core-boundary.md`](../architecture/core-boundary.md).
- **Browser-side reimplementation of Rust date, query, migration, or mutation
  policy.** No calendar arithmetic, span containment, week-numbering, empty-entry
  cleanup, conflict resolution, aggregation, ordering, or schema migration in
  TypeScript. The demo's hard-coded calendar grid is a picture of a calendar,
  not a calendar implementation to port.

---

## 4. Deferred scope

Not in v0.1.0. Not to be scaffolded, stubbed, or anticipated with placeholder
settings, dormant dependencies, or speculative tables.

- **Search** — including any full-text index.
- **Accounts** — no sign-in, no identity service, no profile.
- **Sync** — no server, no conflict merging across devices.
- **Telemetry.**
- **Analytics.**
- **Cloud AI** — any AI at all requires explicit provider consent, privacy
  controls, and source disclosure; none of that exists here yet.
- **Collaborative editing.**
- **Speculative metadata** — people, places, moods, user-created tags, entry
  revision history, standalone summaries.
- **Full parity with the native Timeline's advanced continuous-scale
  presentation** — continuous pinch zoom, elastic scale endpoints, lane
  assignment with `+n` overflow, clustering, vertical rail titles, and haptic
  scroll landing. v0.1.0 targets a correct bounded read-only Timeline at
  discrete scales, not that presentation.
