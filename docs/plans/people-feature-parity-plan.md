# People feature parity implementation plan

This plan is specific to the current `LifeArchive-web` architecture. It keeps
the public frontend independent of the private core repository and treats the
compiled browser runtime as the only durable implementation. Its parity target
is the native product's information architecture, terminology, and task flow,
not a pixel-for-pixel copy of iOS navigation or presentation.

The current dark-mode native implementation is documented in the
[People visual reference set](assets/people-feature-parity/README.md). Use it
for hierarchy, grouping, terminology, and interaction states, together with
the web translation notes included beside the screenshots.

## Cross-platform parity contract

Keep these product relationships familiar on both platforms:

- Index is a first-class main destination for reusable archive entities and
  collections. People lives at Index → People; Record's People controls remain
  contextual to the selected entry.
- The Index landing surface exposes People, Tracks, and Media as peer cards.
  People and Tracks open their archive-wide managers. Media has no Index
  destination in this plan and must not open or absorb an existing
  storage/size-reduction tool.
- Selecting a Person already linked to a Record opens an entry-specific task
  card. The card uses the same interaction roles, order, labels, and selected
  state as the Add People flow, followed by View Person, Edit Person, and
  Remove from this entry actions.
- View and Edit use the shared Person profile/editor rather than a Record-only
  duplicate. Leaving them restores the user's prior Index or Record context.
- A loaded People page renders from the initial request immediately. It must
  never require search input, manage-mode changes, or another user action to
  publish the result.

Translate that contract into web-native behaviour:

- Use canonical, addressable routes such as `/index`, `/index/people`,
  `/index/people/:personId`, and the router's edit-state convention. Use
  browser history and a visible in-product back/breadcrumb action instead of
  imitating an iOS tab switch or `NavigationStack`.
- Present contextual tasks as an anchored popover or dialog on wide layouts
  and a focus-trapped dialog/drawer on compact layouts, following the existing
  Tracks overlay language. Do not force every viewport into an iOS-style sheet.
- Preserve the origin route, selected record, scroll position, unsaved editor
  buffer, and opener focus when a Record handoff visits People. Validate all
  restored locations before using them; a stale origin falls back to the
  appropriate People or Index route.
- Let responsive web controls wrap or horizontally scroll when needed while
  preserving control order and meaning. Match familiar hierarchy and outcomes,
  not platform-specific dimensions, gestures, or toolbar placement.

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
- Make initial loading an explicit controller state and publish the first
  successful page through the same observable state as later paging. Distinguish
  initial loading, empty, loaded, retryable failure, and incremental loading so
  the page cannot remain behind a stale spinner until search or manage mode
  changes.
- Reuse `RecordOverlay` and the Tracks interaction language for the anchored
  multi-select picker, active/archived manager, quick creation, and shared
  Person editor.
- Preserve manager search, pages, scroll position, editor input, opener focus,
  and picker selection across task transitions and failures.
- Implement complete profiles, connection labels, partial dates, references,
  durable photos, archive/restore, merge, safe delete, memories, and recorded
  contact without duplicating core policy in TypeScript.

## 4. Add the People destination

- Add `/index` as a first-class main-navigation destination with responsive
  People, Tracks, and Media cards. People opens `/index/people`; Tracks opens
  the shared archive-wide Track manager. Keep Media visibly deferred and
  non-navigating until its own content is approved; do not route it to a media
  optimisation or archive-storage screen.
- Make `/index/people` the canonical responsive People page and reuse the
  manager and Person editor for addressable view/edit routes. Only retain a
  `/people` compatibility redirect if a previously shipped route requires it;
  do not maintain two independent People destinations.
- Update startup and last-destination preferences around Index. A legacy
  People preference may resolve to Index → People, while current preferences
  should preserve the most specific safe Index route the product supports.
- Provide clear Index → People hierarchy through page titles and
  breadcrumbs/back actions. Browser Back must remain trustworthy, including
  when a profile was opened from Record rather than from the People directory.
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
- Make the Person portrait, name, and linked-person row open one responsive
  Person task card rather than navigating directly or opening a menu of
  disconnected commands.
- Give the card a large profile-photo/initials hero matching the shared Person
  profile's identity treatment, but omit the date-of-birth/life-date line in
  this entry-specific context. Follow it with the Add People flow's horizontal
  interaction controls and then an action list in this order: View Person,
  Edit Person, Remove from this entry.
- Keep the linked-People section's familiar role-weighted hierarchy when more
  than one Person is present: show the total in the People heading; present
  About and Together people as prominent portrait/name/role tiles; group Brief
  people as compact identity rows under a Brief label; and group role-free
  Included people as compact identity rows under `Also in entry`. Adapt the
  column count and spacing to web width without flattening every role into one
  generic list.
- Keep role updates in the open card, show the new selected state immediately,
  disable conflicting actions while the mutation is pending, and retain the
  card with a retryable error on failure. Availability still follows the
  record-type rules above; do not manufacture interaction for unsupported
  records in React.
- View Person and Edit Person close the contextual layer and hand off to the
  canonical Index → People route with a validated origin. Browser Back returns
  to the same Record state; in-product People/Index navigation remains usable
  when the origin no longer exists.
- Remove from this entry uses the existing revision-safe removal and
  complete-snapshot Undo path. It does not archive, merge, or delete the Person.

## 6. Finish product quality and evidence

- Localize every visible and accessible string and cover keyboard, dialog/menu
  roles, checkbox state, focus trapping/restoration, reduced motion, large
  text, mobile layout, photo/initial labels, and complete context announcements.
- Add regression coverage proving the first People page appears after its
  initial request without a search/manage-mode nudge, including leaving and
  returning to Index → People.
- Add route and history coverage for Index → People, addressable profile and
  edit states, Record-origin View/Edit handoffs, restored Record state, and a
  stale-origin fallback. Assert that the Media card cannot open the
  storage/size-reduction manager.
- Add responsive task-card coverage for portrait fallback, omitted life dates,
  role ordering and mutation, View/Edit routing, removal/Undo, keyboard focus,
  Escape/backdrop dismissal, and compact versus wide presentation.
- Update scope and runtime/core-boundary documentation while preserving
  `docs/reference/` byte-for-byte.
- Add focused Vitest coverage, Track-comparable Playwright flows, archive count
  coverage, and a real local-runtime persistence/reload/archive round-trip
  smoke path.
- Run focused suites throughout, then the private release checks, `pnpm check`,
  relevant Playwright suites, production artifact fetch, and final browser
  negotiation before committing coherent review steps.
