# People feature parity implementation plan

This plan is specific to the current `LifeArchive-web` architecture. It keeps
the public frontend independent of the private core repository and treats the
compiled browser runtime as the only durable implementation.

## 1. Qualify the current runtime surface

- Close the browser byte-transfer and archive-overview gaps in the private
  runtime before exposing the affected UI.
- Advance the runtime and affected public contract versions deliberately.
- Run the private browser conformance, packaging, reproducibility, and release
  checks, then install the verified artifact locally.
- Publish one immutable artifact and pin its exact URL, checksum, Product
  contract, ABI, dependency profile, and ordered capability inventory.

## 2. Upgrade the public client boundary

- Replace Product 5 compatibility assumptions with the exact current browser
  profile in the runtime policy, loader, worker admission, and tests.
- Add ergonomic Person, Record-People, photo, memory, contact, merge, delete,
  and archive projection values beneath `LifeArchiveClient`.
- Map and validate the runtime surface once in `runtimeBoundary`; keep wire
  envelopes and generated declarations out of feature code.
- Extend the development mock, fixed test client, durable-operation inventory,
  failure mapping, and public/private boundary guards.

## 3. Build one reusable People task flow

- Add a People controller with bounded search, stable paging, stale-response
  rejection, selection, drafts, expected revisions, invalidations, retry, and
  conflict state.
- Reuse `RecordOverlay` and the Tracks interaction language for the anchored
  multi-select picker, active/archived manager, quick creation, and shared
  Person editor.
- Preserve manager search, pages, scroll position, editor input, opener focus,
  and picker selection across task transitions and failures.
- Implement complete profiles, connection labels, partial dates, references,
  durable photos, archive/restore, merge, safe delete, memories, and recorded
  contact without duplicating core policy in TypeScript.

## 4. Add the People destination

- Add `/people` and main navigation, startup/last-destination preferences, and
  a responsive People page that reuses the manager and Person editor.
- Present bounded memories and contact-history pages with exact Record routes.
- Keep contact summaries cautious and render only core-provided aggregates.

## 5. Integrate Record People context

- Add a Record-People controller for ordinary and structured destinations,
  including absent ordinary entries and atomic creation snapshots.
- Coordinate returned parent revisions with every writing/media controller so
  a context mutation cannot make a pending editor save stale.
- Implement Add Context, optional presence, per-record-type new-record
  preferences, ordered tiles, picker, entry-specific context, clear/remove,
  complete-snapshot Undo, quick creation, and broad-record Log Contact.
- Offer interaction only for exact Day and Event records; participation and
  subject remain independent everywhere.

## 6. Finish product quality and evidence

- Localize every visible and accessible string and cover keyboard, dialog/menu
  roles, checkbox state, focus trapping/restoration, reduced motion, large
  text, mobile layout, photo/initial labels, and complete context announcements.
- Update scope and runtime/core-boundary documentation while preserving
  `docs/reference/` byte-for-byte.
- Add focused Vitest coverage, Track-comparable Playwright flows, archive count
  coverage, and a real local-runtime persistence/reload/archive round-trip
  smoke path.
- Run focused suites throughout, then the private release checks, `pnpm check`,
  relevant Playwright suites, production artifact fetch, and final browser
  negotiation before committing coherent review steps.
