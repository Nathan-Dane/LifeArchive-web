# LifeArchive Web v0.1.0 public implementation plan

## Purpose

This is the executable plan for work that belongs in the public
`LifeArchive-web` repository. It coordinates with a private master plan and a
separately released proprietary runtime, but it contains no private Rust source
layout, persistence schema, migration detail, contract fixture, operation
vector, or private build identity.

The frontend is an MPL-2.0 presentation edge. It renders, captures input,
holds transient editor/navigation state, localises copy, manages browser
permissions and file handoff, and communicates through one ergonomic
`LifeArchiveClient`. The separately licensed worker-hosted runtime owns every
durable decision.

This public plan has **35 focused steps**. They correspond to public portions
of the 52-step master sequence. Each step is intended for one agent session,
one focused commit, and a buildable repository.

## Hard boundaries

- React never accesses SQL, SQLite records, schema versions, migrations, OPFS
  files, or archive record collections.
- Archive content, archive metadata, editor drafts, structured objects, media,
  and Tracks never use `localStorage`. Presentation preferences may.
- No production IndexedDB or TypeScript persistence fallback is permitted.
- Features never reconstruct Record/Timeline aggregates, time boundaries,
  week numbers, ordering, conflict policy, or archive semantics.
- The real runtime always runs in a dedicated worker. Features communicate only
  through `LifeArchiveClient`.
- Generated runtime declarations and wire envelopes remain inside
  `src/core/runtime/`; they never appear in component props.
- A mock is explicit, visible, non-durable, policy-free, and excluded from
  production. Runtime failure never selects it.
- Missing, unverified, incompatible, locked, corrupt, newer, or failed runtime
  state is explicit. It is never presented as an empty archive.
- Writing remains in the editor buffer after failed/conflicting saves.
- Service-worker caches never contain archive content, media, exports, or
  object URLs.
- Search, sync, accounts, telemetry, analytics, AI, People, Places, custom
  tags, and speculative metadata are absent.

## External blocking gates

The public repository does not implement or choose production persistence. The
private runtime release must provide evidence for:

1. the complete Rust-owned archive store over a browser-persistent filesystem;
2. create/reopen after reload and browser restart;
3. exclusive ownership and second-tab failure;
4. migration, corruption refusal, and crash recovery;
5. revision-safe save and no-op/empty semantics;
6. archive verify/import/export/erase atomicity;
7. durable exact media;
8. the approved Chromium/Firefox/Safari support matrix.

Real integration steps are blocked until that gate passes. Steps 01–08 and
visual feature work against the development mock may proceed in parallel, but
they must not claim real durability.

## Reference interpretation

The preserved HTML reference supplies hierarchy, spacing, visual tone,
responsive breakpoints, staged drawers, calendar expansion, keyboard intent,
and appearance intent. It is never imported or copied.

Explicit mismatches:

- omit People, Places, and Related scales;
- store Markdown, not HTML;
- compact tag presentation uses the runtime-designated display tag rather than
  several equal colour chips;
- Saved and local-persistence claims come from real results only;
- calendar cells/time navigation come from client operations, never hard-coded
  browser arithmetic.

## Track and phase map

| Phase | Tracks | Public exit condition |
|---|---|---|
| Boundary/foundation | A, C | One client, one worker transport, explicit mock, safe unavailable states |
| Archive lifecycle | D | Create/import/reopen/status/export/verify/erase are truthful and recoverable |
| Real Record slice | E | Exact ordinary writing survives save, reload, close, and reopen |
| Record expansion | E | Events, Spans, Tracks, markers, metadata, then media |
| Timeline | F | Bounded read-only chronology with empty periods and exact Record handoff |
| Offline/self-host | G | Version-safe PWA and complete static bundle |
| Release | H | Exact runtime pin and accepted-browser RC evidence |

---

## Track A / C — Contract boundary and frontend foundation

### Step 01 — Define the ergonomic `LifeArchiveClient`

- **Purpose:** establish the sole feature-facing durable-state interface.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** public scope/architecture read; approved runtime capability inventory available as release metadata.
- **Exact files or directories expected to change:** `src/core/client/LifeArchiveClient.ts`, `types.ts`, `errors.ts`, `capabilities.ts`, `index.ts`, architecture tests.
- **Behaviour to implement:** define coarse methods and ergonomic discriminated values for runtime/archive state, time navigation, Record, Tracks, Timeline, media, identity, archive lifecycle, invalidation, and cancellation.
- **Important design or architecture constraints:** no wire/generated type escapes; revisions stay lossless strings; no raw execute/store handle/SQL/path; no AI/Search/sync methods.
- **Tests to add or update:** compile-time fake, exact-ID/revision samples, exhaustive state switches, dependency guard preventing feature imports from `src/core/runtime`.
- **Commands to run:** `pnpm test:run`; `pnpm typecheck`; `pnpm safety`; `pnpm check`.
- **Acceptance criteria:** every planned feature can depend only on this interface, and the interface chooses no Rust-owned outcome.
- **Expected commit boundary:** types/interface/tests only.
- **Suggested commit message:** `feat(core): define the LifeArchive client boundary`
- **Dependencies on earlier steps:** none.
- **Explicitly deferred work:** client implementations and UI.
- **Risks or unknowns:** avoid one oversized DTO; prefer operation-specific immutable values.

### Step 02 — Define and implement worker transport

- **Purpose:** keep all runtime work off the main thread with explicit lifecycle semantics.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Step 01 and approved public browser ABI.
- **Exact files or directories expected to change:** `src/core/runtime/worker/protocol.ts`, `WorkerTransport.ts`, `runtime.worker.ts`, tests/fixtures.
- **Behaviour to implement:** versioned correlated request/response/failure messages; buffer transfer; serialized admission; scoped cancellation; ready/fatal/closed states; definitive shutdown; rejection of late or duplicate replies.
- **Important design or architecture constraints:** transport has no product policy or retries; feature code cannot instantiate the worker; stopping a Promise wait is not presented as cancelling a durable operation.
- **Tests to add or update:** duplicate IDs, malformed messages, worker crash, cancellation races, close while busy, transfer ownership, listener cleanup, StrictMode double start.
- **Commands to run:** `pnpm test:run`; `pnpm typecheck`; `pnpm check`.
- **Acceptance criteria:** every request has one terminal outcome and worker loss cannot silently reset archive state.
- **Expected commit boundary:** transport only.
- **Suggested commit message:** `feat(runtime): add the versioned worker transport`
- **Dependencies on earlier steps:** Step 01.
- **Explicitly deferred work:** artifact loading and real product calls.
- **Risks or unknowns:** distinguish client abort, runtime cancellation, and definitive operation result.

### Step 03 — Validate the runtime lock, manifest, checksum, and generated surface

- **Purpose:** load only the exact reviewed runtime and expose explicit failure states.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 01–02; manifest/ABI format published.
- **Exact files or directories expected to change:** `src/core/runtime/runtimeLock.ts`, `runtimeManifest.ts`, `RuntimeLoader.ts`, hash/fetch helpers, tests, `scripts/fetch-runtime.mjs`, updated runtime-lock tests.
- **Behaviour to implement:** validate `runtime/runtime.lock.json`; fetch immutable bundle; verify whole artifact and per-file hashes; validate manifest/ABI/contract/capabilities/environment; load generated declarations only within runtime module.
- **Important design or architecture constraints:** no checksum override; no `latest`/range; public build/check works with no artifact; unavailable/mismatch never opens archive or mock.
- **Tests to add or update:** not-integrated, missing, changed byte, manifest disagreement, incompatible ABI/contract, missing capability, CORS/environment failure, successful fixed test bundle.
- **Commands to run:** `pnpm safety`; `pnpm test:run`; `pnpm build`; `pnpm check`.
- **Acceptance criteria:** an unverified byte is never instantiated, and absence is a tested product state.
- **Expected commit boundary:** lock/manifest/fetch verification only.
- **Suggested commit message:** `feat(runtime): verify the exact runtime artifact`
- **Dependencies on earlier steps:** Steps 01–02.
- **Explicitly deferred work:** real archive open and production pin.
- **Risks or unknowns:** streaming hash/browser support, CORS/CORP, CSP, and base-path URL resolution.

### Step 04 — Map the runtime into `RuntimeLifeArchiveClient`

- **Purpose:** isolate generated declarations, wire values, and runtime failures behind ergonomic values.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 01–03.
- **Exact files or directories expected to change:** `src/core/runtime/RuntimeLifeArchiveClient.ts`, mappers, runtime-state model, adapter contract tests.
- **Behaviour to implement:** negotiate required capabilities; map requests/results/failures once; preserve IDs, revisions, civil-date strings, ordered arrays, absence, and transferable bytes; surface unsupported capabilities honestly.
- **Important design or architecture constraints:** adapter maps but does not validate/derive/reorder/merge; no generated type crosses `src/core/runtime`.
- **Tests to add or update:** mapper fixtures, maximum revision, unknown semantic IDs, unknown stable error fallback, conflict current state, missing capability, declaration import guard.
- **Commands to run:** `pnpm test:run`; `pnpm typecheck`; `pnpm check`.
- **Acceptance criteria:** features receive only client types and no runtime shape appears in component tests or props.
- **Expected commit boundary:** real adapter with fixed test runtime only.
- **Suggested commit message:** `feat(runtime): map the worker runtime into LifeArchiveClient`
- **Dependencies on earlier steps:** Steps 01–03.
- **Explicitly deferred work:** archive screens.
- **Risks or unknowns:** accidental frontend branching on private failure detail; expose only actionable ergonomic categories.

### Step 05 — Add the explicit development-only mock

- **Purpose:** allow UI work while the real persistence artifact is gated.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Step 01.
- **Exact files or directories expected to change:** `src/core/mock/MockLifeArchiveClient.ts`, fixed scenarios, call recorder, mode selection, tests.
- **Behaviour to implement:** literal snapshots/scripted results; visible non-durable banner; explicit local developer selection; production exclusion.
- **Important design or architecture constraints:** no persistence, date arithmetic, aggregation, conflict resolution, archive encoding, IndexedDB, archive `localStorage`, or fallback.
- **Tests to add or update:** interface conformance, fixed call recording, scripted conflict/failure, visible banner, production bundle cannot select/instantiate mock.
- **Commands to run:** `pnpm test:run`; `pnpm build`; `pnpm safety`; `pnpm check`.
- **Acceptance criteria:** feature development is possible without any user mistaking mock data for an archive.
- **Expected commit boundary:** mock/test support only.
- **Suggested commit message:** `test(core): add an explicit non-durable mock client`
- **Dependencies on earlier steps:** Step 01.
- **Explicitly deferred work:** policy-computing fake behaviour.
- **Risks or unknowns:** fixture drift; keep values literal and cover the real adapter separately.

### Step 06 — Compose routes, runtime/archive states, and error boundaries

- **Purpose:** replace temporary headings with a safe application state machine.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 01–05.
- **Exact files or directories expected to change:** `src/app/providers/`, `AppShell.tsx`, `AppRoutes.tsx`, runtime/archive gates, error boundaries, tests.
- **Behaviour to implement:** booting; runtime unavailable/incompatible; no archive; opening; open; locked; recoverable failure; fatal state; route gating for Record/Timeline/Settings; stable retry.
- **Important design or architecture constraints:** failures never create/show empty replacement data; production never enters mock; last correct non-editable view may remain during recoverable refresh.
- **Tests to add or update:** every state/route, error reset, deep link, reload, StrictMode, and forbidden durability/availability claims.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** editor/archive actions render only when a compatible real archive is open or explicit dev mock is visibly selected.
- **Expected commit boundary:** app composition/state screens.
- **Suggested commit message:** `feat(app): compose runtime and archive states`
- **Dependencies on earlier steps:** Steps 01–05.
- **Explicitly deferred work:** lifecycle actions.
- **Risks or unknowns:** avoid router lifecycle duplicating client open calls.

### Step 07 — Establish typed localisation and formatting

- **Purpose:** centralise every visible and assistive string before feature growth.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Step 06.
- **Exact files or directories expected to change:** `src/i18n/`, feature catalogs, locale/date/number helpers, lint/tests.
- **Behaviour to implement:** English catalog; stable keys; complete phrases/plurals; locale-aware formatting; semantic icon/tag labels supplied by UI catalogs; safe generic error fallback.
- **Important design or architecture constraints:** no raw user-facing component strings; browser does not calculate civil spans; no language preference until a second complete translation.
- **Tests to add or update:** missing key, interpolation/plural, locale rerender, accessibility copy, unknown error/semantic ID fallback.
- **Commands to run:** `pnpm lint`; `pnpm test:run`; `pnpm check`.
- **Acceptance criteria:** all visible/ARIA copy is catalog-backed and date phrases are not concatenated fragments.
- **Expected commit boundary:** localisation infrastructure and current shell migration.
- **Suggested commit message:** `feat(i18n): add typed frontend localisation`
- **Dependencies on earlier steps:** Step 06.
- **Explicitly deferred work:** second locale and language selector.
- **Risks or unknowns:** error localization must not depend on unstable diagnostic text.

### Step 08 — Build design tokens, responsive shell, and accessibility utilities

- **Purpose:** create maintainable visual/accessibility foundations from the reference.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 06–07.
- **Exact files or directories expected to change:** `src/styles/tokens.css`, themes/typography/layout, `src/app/shell/`, focus/drawer primitives, `src/test/` viewport/accessibility fixtures, tests.
- **Behaviour to implement:** explicit dark/light sets; archival typography/surfaces; wide three-region shell; staged details/navigation drawers; focus trap/restore; Escape; landmarks; reduced motion; visible focus.
- **Important design or architecture constraints:** do not copy/import reference HTML/CSS; no unsupported cards; presentation preferences only may use localStorage; no colour-only state.
- **Tests to add or update:** desktop/tablet/mobile, both themes, contrast, drawer mutual exclusion, keyboard, 200% zoom, reduced motion, reference hash.
- **Commands to run:** `shasum -a 256 docs/reference/record-v0.1.0.html`; `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** independent components match the reference hierarchy and work keyboard-first at all breakpoints.
- **Expected commit boundary:** tokens/shell/primitives only.
- **Suggested commit message:** `feat(ui): add the responsive accessible shell`
- **Dependencies on earlier steps:** Steps 06–07.
- **Explicitly deferred work:** Record content and visual fine-tuning.
- **Risks or unknowns:** automated checks require later VoiceOver/non-Apple screen-reader manual evidence.

---

## Track A / D — Browser files and archive lifecycle

### Step 09 — Decision gate: prove the public archive file handoff

- **Purpose:** select a cross-browser user-facing way to import/export the runtime-produced canonical archive files.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 02–04 and approved runtime bridge options.
- **Exact files or directories expected to change:** public ADR/design note, prototypes/tests under `src/platform/files/`; no production dependency until selected.
- **What is being proven:** users can select/import, export/deliver, and later re-import exact bytes on every promised browser.
- **Possible outcomes:** direct directory handoff; a specified lossless outer download/upload transport; a narrower supported-browser matrix.
- **Evidence required:** filename/path/byte preservation, large-media streaming, cancellation, unsafe input refusal by runtime, partial delivery behaviour, and manual engine results.
- **Blocked later steps:** 11, 14, 34, and release.
- **Failure path:** request product-owner/runtime direction; do not invent archive packaging or parse manifests in React.
- **Behaviour to implement:** record the accepted handoff and implement only its browser acquisition/delivery adapter, leaving archive interpretation in the runtime.
- **Important design or architecture constraints:** worker/runtime owns archive contents; main thread only acquires/delivers handles or transfers; no full large-package JSON/base64.
- **Tests to add or update:** synthetic public-safe file collections and selected engine E2E.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** selected transport and supported browsers are explicit, lossless, and do not redefine `.lifearchive`.
- **Expected commit boundary:** decision/prototype only.
- **Suggested commit message:** `docs(files): decide browser archive handoff`
- **Dependencies on earlier steps:** Steps 02–04.
- **Explicitly deferred work:** full import/export UI.
- **Risks or unknowns:** directory APIs, download collision behaviour, memory, and dependency licensing.

### Step 10 — Implement first-run archive creation

- **Purpose:** create/open the one browser-local archive through a verified runtime.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** private persistence gate passed; Steps 04, 06–08.
- **Exact files or directories expected to change:** `src/features/archive/firstRun/`, create controller/view/tests, route integration.
- **Behaviour to implement:** explain local-only status; request persistent storage where appropriate; create/open canonical runtime root; wait for ready/recovery; route to Record.
- **Important design or architecture constraints:** no backup claim; persistence refusal is truthful best-effort state; failed open does not show a new empty archive; one active archive only.
- **Tests to add or update:** success, permission denied, unavailable quota, locked, failed open, retry, reload.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** real creation is available only after runtime readiness and reopens later.
- **Expected commit boundary:** first-run/create only.
- **Suggested commit message:** `feat(archive): create the browser-local archive`
- **Dependencies on earlier steps:** Steps 04, 06–08 and external persistence gate.
- **Explicitly deferred work:** import and multiple archives.
- **Risks or unknowns:** persistence permission interaction differs by engine.

### Step 11 — Implement validated atomic import

- **Purpose:** apply a selected archive without risking prior state.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 09–10 and runtime archive proof.
- **Exact files or directories expected to change:** `src/features/archive/import/`, selected `src/platform/files/` bridge, progress/cancel/result tests.
- **Behaviour to implement:** acquire package; transfer to worker; verify/apply through client; scoped cancellation; report imported/skipped/conflict outcomes; preserve prior archive UI after failure.
- **Important design or architecture constraints:** no record enumeration, manifest parsing, rollback, duplicate policy, or overwrite logic in frontend.
- **Tests to add or update:** success, duplicate/no-op, invalid/newer/checksum/media failure, cancellation, different archive, reload/reopen, unchanged prior archive.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** imported writing/media reopen; every failed import leaves prior state visible and intact.
- **Expected commit boundary:** import only.
- **Suggested commit message:** `feat(archive): add validated atomic import`
- **Dependencies on earlier steps:** Steps 09–10.
- **Explicitly deferred work:** destructive replace mode.
- **Risks or unknowns:** file permission revocation and large-package progress.

### Step 12 — Reopen automatically and surface storage/lock/recovery states

- **Purpose:** make startup and second-tab behaviour dependable.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Step 10 and runtime lifecycle/locking proof.
- **Exact files or directories expected to change:** archive session provider/controller, state views, tests.
- **Behaviour to implement:** automatically open canonical root; show opening/recovery; map locked, unsupported browser, corrupt/newer store, recovery incomplete, quota/I/O, runtime mismatch; definitive close/retry.
- **Important design or architecture constraints:** no auto erase/recreate/import; archive absence and failed open are distinct; no hidden second writer.
- **Tests to add or update:** every state, two tabs, first tab close/reacquire, worker crash, stale open response, reload/browser restart.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** same archive reopens without selection and failure never masquerades as empty.
- **Expected commit boundary:** archive session/reopen states.
- **Suggested commit message:** `feat(archive): reopen safely and surface store states`
- **Dependencies on earlier steps:** Step 10 and external lock/recovery proof.
- **Explicitly deferred work:** automatic repair outside runtime recovery.
- **Risks or unknowns:** browser-cleared origin data must be described honestly.

### Step 13 — Add Settings overview and truthful persistence status

- **Purpose:** show archive identity, health, counts, local-only facts, and approximate browser storage facts.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 07–08, 12.
- **Exact files or directories expected to change:** `src/features/settings/archive/`, overview controller/cards, `src/platform/storage/`, tests.
- **Behaviour to implement:** runtime overview/identity; media count/bytes; health/recovery; persistent grant; approximate usage/quota; Manage Archive navigation.
- **Important design or architecture constraints:** no raw enumeration; no backup/sync wording; estimates labeled approximate; erase remains reachable when overview fails.
- **Tests to add or update:** healthy/failure, persistent/best-effort/unavailable estimate, title fallback, large counts, localization/accessibility.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** every status traces to a runtime or browser value and cannot be a decorative constant.
- **Expected commit boundary:** Settings overview/status only.
- **Suggested commit message:** `feat(settings): show truthful archive and storage status`
- **Dependencies on earlier steps:** Steps 07–08, 12.
- **Explicitly deferred work:** AI and unsupported preference placeholders.
- **Risks or unknowns:** whether Life Details editing ships in v0.1 needs product-owner direction.

### Step 14 — Add export and standalone verification

- **Purpose:** deliver and verify a portable archive without frontend format logic.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 09, 11–13 and runtime export/verify proof.
- **Exact files or directories expected to change:** `src/features/archive/export/`, `verify/`, selected file delivery bridge, tests.
- **Behaviour to implement:** request verified export; deliver selected transport; scoped cancellation; read-only verification of selected package without opening/mutating active store.
- **Important design or architecture constraints:** no manifest/checksum parsing; no service-worker caching; object URLs/handles revoked; no success claim for partial output.
- **Tests to add or update:** export/import round trip, cancellation, delivery failure/collision where observable, valid/invalid/newer verify, large media, URL cleanup.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** exported package verifies and imports into a fresh archive with exact writing/media.
- **Expected commit boundary:** export and verify.
- **Suggested commit message:** `feat(archive): export and verify portable archives`
- **Dependencies on earlier steps:** Steps 09, 11–13.
- **Explicitly deferred work:** encryption, signatures, cloud destinations.
- **Risks or unknowns:** browser download APIs may not offer destination no-replace evidence.

### Step 15 — Add deliberate archive erase and recovery messaging

- **Purpose:** support explicit deletion while preserving safe failure behaviour.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 12–14.
- **Exact files or directories expected to change:** erase confirmation/result/recovery components/controllers/tests.
- **Behaviour to implement:** deliberate localized confirmation; one client erase call; close stale editors; show fresh empty archive only after success; preserve existing exports; retry/recovery on failure.
- **Important design or architecture constraints:** no direct OPFS deletion; no automatic erase; operation remains available when overview fails.
- **Tests to add or update:** cancel, success, failures, overview failure, pending recovery, fresh identity after reopen, exports untouched.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** failed erase never clears the presented archive; successful erase leaves a usable real empty archive.
- **Expected commit boundary:** erase only.
- **Suggested commit message:** `feat(archive): add deliberate coordinated erase`
- **Dependencies on earlier steps:** Steps 12–14.
- **Explicitly deferred work:** trash/undo and multiple archives.
- **Risks or unknowns:** confirmation interaction awaits product-owner choice.

---

## Track E — Record v0.1.0

### Step 16 — Build client-driven temporal navigation and calendar

- **Purpose:** implement the Record navigation panel without browser date arithmetic.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 01, 05, 07–08.
- **Exact files or directories expected to change:** `src/features/record/navigation/`, controller/components/tests.
- **Behaviour to implement:** global nav; Day/Week/Month/Year; one cursor; previous/next/Today; civil location; bounded week strip; month expansion from client-returned spans; Escape/expanded/focus semantics.
- **Important design or architecture constraints:** no hard-coded calendar grid/week numbering/unbounded list; anchor preserved through client operations.
- **Tests to add or update:** call expectations, stale generation, keyboard, expansion, scale/anchor, responsive drawer.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** every temporal value comes from the client and every gesture-equivalent action has a control.
- **Expected commit boundary:** navigation/calendar only, mock-safe.
- **Suggested commit message:** `feat(record): add client-driven time navigation`
- **Dependencies on earlier steps:** Steps 01, 05, 07–08.
- **Explicitly deferred work:** entry bodies and carousel physics.
- **Risks or unknowns:** a calendar-context client operation may be needed rather than frontend grid derivation.

### Step 17 — Compose ordinary and stable-ID object selection

- **Purpose:** structure the Record workspace into maintainable components.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Step 16.
- **Exact files or directories expected to change:** `src/features/record/objects/`, page controller/layout/details drawer/tests.
- **Behaviour to implement:** fixed ordinary Day control; ordered structured rail/Add; broader Objects picker; exact object ID destination; staged details drawer; moved-object notice/fallback.
- **Important design or architecture constraints:** never re-sort/deduplicate or identify by list position/date; one destination state; no title/tab object menu.
- **Tests to add or update:** same-date/overlap fixed fixtures, exact deep link, stale load, broader handoff, responsive drawer mutual exclusion.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** exact selection survives responsive layout and navigation changes.
- **Expected commit boundary:** selection/composition with mock values.
- **Suggested commit message:** `feat(record): compose exact object selection`
- **Dependencies on earlier steps:** Step 16.
- **Explicitly deferred work:** mutations and advanced rail animation.
- **Risks or unknowns:** route state must avoid volatile revisions/writing.

### Step 18 — Add the Markdown editor and formatting controls

- **Purpose:** create a safe immediate buffer and maintainable writing surface.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 05, 17.
- **Exact files or directories expected to change:** `src/features/record/editor/`, formatting helpers/toolbar/buffer controller/tests; package files only after dependency review.
- **Behaviour to implement:** exact Markdown source; undo/redo; heading/emphasis/list/quote/link controls; safe preview; one save-status region; buffer preserved during mock failures.
- **Important design or architecture constraints:** no HTML durability; no raw save claim in mock; accessible keyboard toolbar; no automatic normalization.
- **Tests to add or update:** exact bytes, Unicode/whitespace, selection transforms, undo, paste, IME, keyboard shortcuts, XSS preview, reduced motion.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** stored candidate is exact Markdown and buffer is never replaced by failed load/save state.
- **Expected commit boundary:** editor/formatting only.
- **Suggested commit message:** `feat(record): add the Markdown writing surface`
- **Dependencies on earlier steps:** Steps 05, 17.
- **Explicitly deferred work:** rich HTML, collaboration, media.
- **Risks or unknowns:** editor dependency accessibility, bundle size, licence, and Markdown fidelity.

### Step 19 — Decision gate and implementation: prove the thin real ordinary slice

- **Purpose:** connect the first real durable UI path before structured features.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** external persistence gate passed; compatible exact runtime pinned; Steps 10, 16, 18.
- **Exact files or directories expected to change:** ordinary Record controller/client integration, runtime E2E tests, reviewed runtime lock update.
- **What is being proven:** open archive → exact ordinary load → edit → revision-safe save → reload → close/reopen → exact writing remains.
- **Possible outcomes:** pass on accepted engine matrix; fail with runtime/client/UI evidence; no mock substitution outcome.
- **Evidence required:** Unicode/whitespace bytes, absent/existing/no-op, full reload, close/reopen, browser restart manual record, save result-derived status.
- **Blocked later steps:** 20–25 real integration and release.
- **Failure path:** keep editor in explicit mock development mode and fix runtime/adapter; never add frontend persistence.
- **Behaviour to implement:** connect one exact ordinary entry end to end and expose save/reload/reopen outcomes solely from `LifeArchiveClient` results.
- **Important design or architecture constraints:** opening does not create; cleanup/revision semantics remain runtime-owned.
- **Tests to add or update:** required full E2E in every accepted engine plus unit adapter/controller tests.
- **Commands to run:** `pnpm check`; `pnpm test:e2e`.
- **Acceptance criteria:** recorded UI-level evidence proves writing preservation through the entire sequence.
- **Expected commit boundary:** one ordinary entry only.
- **Suggested commit message:** `feat(record): prove the real durable entry slice`
- **Dependencies on earlier steps:** Steps 10, 16, 18 and external runtime gate.
- **Explicitly deferred work:** structured records and media.
- **Risks or unknowns:** browsers can terminate without lifecycle callbacks; never promise an unacknowledged save.

### Step 20 — Complete autosave, conflict, retry, and navigation safety

- **Purpose:** make continuous editing preserve writing through real failures.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Step 19 passes.
- **Exact files or directories expected to change:** autosave state machine/controller, conflict/failure UI, tests.
- **Behaviour to implement:** debounce; flush before navigation/lifecycle where possible; generation checks; Saving/Saved/Failed/Conflicted; retry; explicit conflict choices; unload warning for pending unacknowledged buffer.
- **Important design or architecture constraints:** buffer retained; no auto-merge/retry over newer writing; stale responses ignored; Saved only after success.
- **Tests to add or update:** rapid typing, reordering, navigation during save, crash, conflict current state, retry, unmount, pagehide/visibility, screen-reader announcements.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** every failed/conflicted path keeps exact buffer and offers an actionable non-destructive choice.
- **Expected commit boundary:** ordinary autosave safety.
- **Suggested commit message:** `feat(record): preserve writing through autosave failures`
- **Dependencies on earlier steps:** Step 19.
- **Explicitly deferred work:** sync merge and revision history.
- **Risks or unknowns:** status announcements must remain useful without becoming noisy.

### Step 21 — Add Event creation, editing, move, and deletion

- **Purpose:** add structured records only after ordinary persistence is proven.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Step 20 and negotiated structured capabilities.
- **Exact files or directories expected to change:** `src/features/record/events/`, shared structured editor/controller/tests.
- **Behaviour to implement:** explicit Create/Cancel; stable ID; civil date; title/icon/tags/Track/Markdown; autosave; moved notice; confirmed soft delete.
- **Important design or architecture constraints:** no time-of-day; runtime validation authoritative; duplicate titles/same-date Events allowed; media waits.
- **Tests to add or update:** cancel/create, invalid result, same-date IDs, move, conflict, exact delete, reload/reopen.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** multiple same-date Events remain exact-ID selectable and durable.
- **Expected commit boundary:** Events only.
- **Suggested commit message:** `feat(record): add revision-safe Event editing`
- **Dependencies on earlier steps:** Step 20.
- **Explicitly deferred work:** Spans, Track management, media.
- **Risks or unknowns:** client affordance validation must not become a second authority.

### Step 22 — Add Spans, ongoing state, markers, conversion, and deletion

- **Purpose:** implement the full supported named-Span editor.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Step 21 and negotiated capabilities.
- **Exact files or directories expected to change:** `src/features/record/spans/`, range/marker/conversion components/tests.
- **Behaviour to implement:** inclusive closed range or absent end shown as Present; marker enable/override/reset; moved-range notice; explicit one-day conversion to Event; save/delete.
- **Important design or architecture constraints:** no compatibility end for ongoing; markers are derived, not objects; runtime owns date validity/conversion.
- **Tests to add or update:** overlap, ongoing toggle, reversed/one-day failure, conversion conflict, marker reset/derived title, move, exact delete, reopen.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** stable identity/writing survive end-state changes and conversion.
- **Expected commit boundary:** Spans/markers only.
- **Suggested commit message:** `feat(record): add ongoing Spans and markers`
- **Dependencies on earlier steps:** Step 21.
- **Explicitly deferred work:** advanced Timeline marker rails.
- **Risks or unknowns:** ongoing results remain bounded by runtime query windows.

### Step 23 — Add Track and member workflows

- **Purpose:** support optional mixed Event/Span Track membership.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 21–22 and Track capabilities.
- **Exact files or directories expected to change:** `src/features/record/tracks/`, chooser/forms/capture/history tests.
- **Behaviour to implement:** list/load/create/save/archive/delete; attach/move/detach; create member; atomic Track plus first member; retain full draft on failure.
- **Important design or architecture constraints:** membership changes no other member field; tag suggestion is creation-only; preserve runtime order/cursors; no nested/inferred Track state.
- **Tests to add or update:** cancel/atomic failure, mixed kinds, multiple ongoing members, membership field preservation, populated delete/detach, conflict/reopen.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** Track changes never rewrite writing/dates/tags/media/markers.
- **Expected commit boundary:** Track workflows.
- **Suggested commit message:** `feat(record): add mixed Event and Span Tracks`
- **Dependencies on earlier steps:** Steps 21–22.
- **Explicitly deferred work:** advanced compressed history visualisation.
- **Risks or unknowns:** deletion wording must distinguish Track deletion from member deletion.

### Step 24 — Add semantic icons, ordered tags, and metadata details

- **Purpose:** complete supported metadata while excluding demo-only models.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 21–23.
- **Exact files or directories expected to change:** semantic icon adapter/assets, tag picker/badges, metadata details/tests.
- **Behaviour to implement:** runtime catalog order/defaults; web glyphs; unknown fallback preserving ID; ordered tags with one display tag; compact one-accent display; complete editor/detail list.
- **Important design or architecture constraints:** no SF Symbol persistence, custom tags, icon search/recents, People, Places, Related; colour has text/icon/type cue.
- **Tests to add or update:** catalog mapping, unknown IDs, ordered/display interactions via client results, contrast, keyboard, accessible labels, compact snapshots.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** visual reference peer-tag mismatch is explicitly neutralised and metadata remains runtime-compatible.
- **Expected commit boundary:** metadata presentation.
- **Suggested commit message:** `feat(record): add semantic icon and tag presentation`
- **Dependencies on earlier steps:** Steps 21–23.
- **Explicitly deferred work:** custom tags and remote icon assets.
- **Risks or unknowns:** icon asset licensing and complete mapping.

### Step 25 — Add durable media

- **Purpose:** add acquisition/gallery/preview/delete only after reopen/recovery proof.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** external media/recovery proof; Steps 20–24.
- **Exact files or directories expected to change:** `src/features/record/media/`, `src/platform/files/mediaAcquisition.ts`, object-URL manager/tests.
- **Behaviour to implement:** acquire file/bytes; capture owner ID/revision; transfer; progress/failure; mark durable only after client success; preview; confirmed delete; refresh.
- **Important design or architecture constraints:** Day/Event/Span only; no invented limits; no persisted handles/object URLs; exact bytes; no Timeline mutation.
- **Tests to add or update:** switch owner during import, conflict, large file, reload/reopen, missing content, deletion failure, URL cleanup, keyboard gallery.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** media survives restart/export/import and is never called durable prematurely.
- **Expected commit boundary:** Record media only.
- **Suggested commit message:** `feat(record): add core-owned durable media`
- **Dependencies on earlier steps:** Steps 20–24 and external media proof.
- **Explicitly deferred work:** transcoding/editing/cloud assets and broader-scale media.
- **Risks or unknowns:** unsafe preview formats, MIME handling, and memory pressure.

### Step 26 — Complete responsive and accessibility Record QA

- **Purpose:** meet the desktop/tablet/mobile, keyboard, screen-reader, motion, and appearance bar.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 16–25.
- **Exact files or directories expected to change:** Record styles/components/tests, Playwright screenshots, manual QA checklist.
- **Behaviour to implement:** three-region wide layout; details overlay; mutual-exclusive mobile drawers; toolbar overflow; single-column media; Escape/focus restore; reduced motion; light/dark.
- **Important design or architecture constraints:** editor remains primary; selected-object delete at bottom; full accessible titles; no reference markup/CSS copy.
- **Tests to add or update:** reference breakpoints, 200% zoom, keyboard-only, VoiceOver and non-Apple screen reader, reduced motion, high contrast, touch, no document overflow.
- **Commands to run:** `shasum -a 256 docs/reference/record-v0.1.0.html`; `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** documented matrix passes in both appearances with unsupported concepts absent.
- **Expected commit boundary:** Record QA/polish.
- **Suggested commit message:** `feat(record): complete responsive accessible Record`
- **Dependencies on earlier steps:** Steps 16–25.
- **Explicitly deferred work:** continuous carousel physics, haptics, AI, Search.
- **Risks or unknowns:** assistive-technology differences need manual evidence.

---

## Track F — Timeline minimum viable view

### Step 27 — Add bounded Timeline client/controller flow

- **Purpose:** load one bounded chronology/index and one settled focused detail.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 04, 19.
- **Exact files or directories expected to change:** `src/features/timeline/controller/`, client integration/tests.
- **Behaviour to implement:** request client time skeleton and bounded index; keep empty rows; focus; one detail after settle; refresh on token change; window extend/trim requests.
- **Important design or architecture constraints:** no per-row calls, reordering, aggregation, date math, or continuous scale.
- **Tests to add or update:** bounds, empty periods, token refresh, stale response, hydration failure retaining chronology, operation-count spy.
- **Commands to run:** `pnpm test:run`; `pnpm check`.
- **Acceptance criteria:** measured one-window data flow exists before visual complexity.
- **Expected commit boundary:** Timeline data/controller.
- **Suggested commit message:** `feat(timeline): add bounded snapshot data flow`
- **Dependencies on earlier steps:** Steps 04, 19.
- **Explicitly deferred work:** scene visuals and structured detail.
- **Risks or unknowns:** frontend owns when to extend/trim, not the actual span boundaries.

### Step 28 — Render chronology, empty periods, and read-only previews

- **Purpose:** deliver a useful basic Timeline at discrete scales.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 07–08, 27.
- **Exact files or directories expected to change:** Timeline scene/rows/focus/preview/detail components/styles/tests.
- **Behaviour to implement:** ordered Day/Week/Month/Year rows including empty; neutral loading; stable focus; compact indicators; bounded preview; read-only detail; Today/scale controls.
- **Important design or architecture constraints:** no editor/import/delete/media mutation; collapsed rows stay compact; hydration never changes row geometry.
- **Tests to add or update:** empty archive, long bounded virtualization, loading/failure, focus/Today, discrete scale anchor, preview bounds, read-only semantics.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** empty periods remain reachable and no row owns a persistence query.
- **Expected commit boundary:** ordinary Timeline presentation.
- **Suggested commit message:** `feat(timeline): render bounded read-only chronology`
- **Dependencies on earlier steps:** Steps 07–08, 27.
- **Explicitly deferred work:** continuous zoom and structured overlays.
- **Risks or unknowns:** virtualisation must preserve accessibility and anchor.

### Step 29 — Add structured details and exact Record handoff

- **Purpose:** browse Events/Spans and intentionally edit the exact object in Record.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 21–24, 28.
- **Exact files or directories expected to change:** Timeline structured summaries/lists/details, handoff routing/tests.
- **Behaviour to implement:** bounded compact objects; basic same-date/overflow list; read-only detail; exact ID plus contained Day handoff; return preserves Timeline.
- **Important design or architecture constraints:** no re-sort/dedup, inline edit, collapsed Markdown/media, or marker-as-Event interpretation.
- **Tests to add or update:** same-date Events, overlapping/ongoing Spans, token conflict, exact handoff/return, moved/deleted object, accessible full title.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** every object opens exact detail and exact Record destination.
- **Expected commit boundary:** minimum structured Timeline.
- **Suggested commit message:** `feat(timeline): add structured detail and Record handoff`
- **Dependencies on earlier steps:** Steps 21–24, 28.
- **Explicitly deferred work:** native-style lanes/clusters/rails/markers.
- **Risks or unknowns:** basic overlap UI must not imply unsupported relationships.

### Step 30 — Harden Timeline position, performance, responsive, and accessibility

- **Purpose:** make bounded data/navigation reliable before advanced presentation.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 27–29.
- **Exact files or directories expected to change:** position/anchor controller, performance assertions, responsive/accessibility tests, QA checklist.
- **Behaviour to implement:** preserve timestamp/scale through resize, refresh, return, extension/trim, detail; keyboard/ARIA order; reduced motion; responsive rows.
- **Important design or architecture constraints:** no query per scroll sample; presentation preferences only may be local; advanced Timeline remains absent.
- **Tests to add or update:** operation budget, DOM/memory bound, resize, return from Record, refresh failure, zoom, keyboard/screen reader.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** stable anchor and measured query bounds across accepted engines.
- **Expected commit boundary:** Timeline hardening.
- **Suggested commit message:** `test(timeline): harden bounded navigation`
- **Dependencies on earlier steps:** Steps 27–29.
- **Explicitly deferred work:** pinch, elastic endpoints, lanes, clustering, vertical titles, haptics.
- **Risks or unknowns:** browser scroll restoration varies; preserve logical time, not pixel offset alone.

---

## Track G — PWA and self-hosting

### Step 31 — Decision gate: define safe frontend/runtime updates

- **Purpose:** prevent mixed cached versions or reload while an archive is open.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Step 03 and an exact compatible runtime release.
- **Exact files or directories expected to change:** public ADR/design under `docs/architecture/`, `src/platform/pwa/` state-model tests/prototype.
- **What is being proven:** old/new immutable asset+runtime sets remain coherent across install, offline startup, update, archive-open state, multiple tabs, close, reload, and rollback.
- **Possible outcomes:** deferred activation after close/user consent; reload-before-open; another proven atomic set protocol.
- **Evidence required:** interrupted download, old offline cache, mismatch/checksum failure, update while open, two tabs, rollback.
- **Blocked later steps:** 32–34 and service-worker registration.
- **Failure path:** ship without service-worker caching/offline-install claim.
- **Behaviour to implement:** record and prototype the selected immutable asset/runtime-set activation, deferral, rollback, and multi-tab flow.
- **Important design or architecture constraints:** never cache user data; service worker never opens archive storage; no unconditional `skipWaiting` while open.
- **Tests to add or update:** state model and browser prototype.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** cache keys, activation, user copy, rollback, and multi-tab behaviour are explicit.
- **Expected commit boundary:** decision/prototype.
- **Suggested commit message:** `docs(pwa): decide safe runtime updates`
- **Dependencies on earlier steps:** Step 03.
- **Explicitly deferred work:** production service worker.
- **Risks or unknowns:** service-worker lifecycle and browser cache eviction are not app-controlled.

### Step 32 — Add app manifest, base paths, and offline shell

- **Purpose:** make the application installable and static-host-friendly.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Step 31 accepted.
- **Exact files or directories expected to change:** `public/manifest.webmanifest`, icons, Vite/base-path config, PWA registration shell, offline view/tests.
- **Behaviour to implement:** install metadata; relative/base-path-safe assets/routes/workers/runtime; cached shell; offline load after install; explicit unavailable state if required runtime files absent.
- **Important design or architecture constraints:** no server/API requirement; secure-context/header requirements documented; no user data in caches.
- **Tests to add or update:** root/subpath builds, manifest validation, offline reload, direct routes/static fallback, no-runtime offline, cache inspection.
- **Commands to run:** `pnpm build`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** same build serves at root and configured subpath and loads its shell offline.
- **Expected commit boundary:** manifest/base path/offline shell.
- **Suggested commit message:** `feat(pwa): add installable base-path-safe shell`
- **Dependencies on earlier steps:** Step 31.
- **Explicitly deferred work:** update activation and self-host bundle.
- **Risks or unknowns:** static host SPA fallback versus hash routing needs one documented choice.

### Step 33 — Implement version-safe service-worker caching

- **Purpose:** cache one verified immutable frontend/runtime set at a time.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 31–32 and exact runtime pin.
- **Exact files or directories expected to change:** service worker, cache manifest generator, update controller/UI/tests.
- **Behaviour to implement:** verify before cache admission; retain active set while archive open; prompt/defer; close then activate/reload; retain working old set on failure; remove only unreferenced old sets.
- **Important design or architecture constraints:** no OPFS/archive/media/export/object URL caching; no incompatible mixed set.
- **Tests to add or update:** install/offline, update open/closed, mismatch, interrupted download, two tabs, rollback, cache allowlist.
- **Commands to run:** `pnpm test:run`; `pnpm test:e2e`; `pnpm build`; `pnpm check`.
- **Acceptance criteria:** update cannot interrupt an open archive or mix runtime/frontend versions.
- **Expected commit boundary:** service worker/update UI.
- **Suggested commit message:** `feat(pwa): cache atomic frontend and runtime versions`
- **Dependencies on earlier steps:** Steps 31–32.
- **Explicitly deferred work:** background sync and push.
- **Risks or unknowns:** activation may be delayed indefinitely by browser/tab lifecycle.

### Step 34 — Document and test the complete self-host bundle

- **Purpose:** let users serve the application statically with its separately licensed runtime.
- **Repository affected:** `LifeArchive-web` docs/tests; combined binary assembly remains outside public Git.
- **Preconditions:** Steps 09, 32–33 and a distributable runtime licence.
- **Exact files or directories expected to change:** self-host docs, sample static-host configurations/headers, bundle verification E2E, NOTICE/README updates.
- **Behaviour to implement:** document exact public build/runtime/checksum/licence layout; root/subpath hosting; required headers; offline core use; no first-party service.
- **Important design or architecture constraints:** do not commit runtime binary; do not call combined app entirely open source; no private-repository access/credentials.
- **Tests to add or update:** serve a release bundle fixture at root/subpath, offline create/browse/import/export, external-request audit, licence/notices presence.
- **Commands to run:** `pnpm safety`; `pnpm test:e2e`; `pnpm check`.
- **Acceptance criteria:** instructions are sufficient to serve a verified complete bundle on a static host.
- **Expected commit boundary:** public self-host docs/tests.
- **Suggested commit message:** `docs(hosting): add complete static self-host guidance`
- **Dependencies on earlier steps:** Steps 09, 32–33.
- **Explicitly deferred work:** hosted service, SSR, accounts.
- **Risks or unknowns:** some hosts cannot emit runtime-required headers.

---

## Track H — Runtime update and release candidate

### Step 35 — Qualify and pin the v0.1.0 release candidate

- **Purpose:** prove the public product and adopt one exact compatible runtime without coupling other platforms.
- **Repository affected:** `LifeArchive-web`.
- **Preconditions:** Steps 01–34 and private runtime/browser gates passed.
- **Exact files or directories expected to change:** reviewed `runtime/runtime.lock.json`, public support matrix/release notes, RC E2E/accessibility/security evidence; runtime binaries remain downloaded/ignored.
- **Behaviour to implement:** verify the private-originated update PR; run create/import/reopen/Record/structured/Tracks/media/export/verify/erase/Timeline/PWA/self-host; merge exact pin only after success.
- **Important design or architecture constraints:** public CI gets no private-read credentials; failure retains old pin; web release does not change iOS/Android core pins; no unsupported feature claims.
- **Tests to add or update:** `pnpm check`, accepted-engine E2E, browser restart/manual recovery, offline/self-host, accessibility, cache/storage inspection, archive round trip.
- **Commands to run:** `pnpm safety`; `pnpm check`; `pnpm test:e2e`.
- **Acceptance criteria:** lock/manifest/checksum agree, all promised engines pass, rollback remains available, and no data-safety blocker remains.
- **Expected commit boundary:** exact lock/release docs only; fixes are separate commits.
- **Suggested commit message:** `release: qualify LifeArchive Web v0.1.0`
- **Dependencies on earlier steps:** Steps 01–34.
- **Explicitly deferred work:** Search, sync, accounts, telemetry, analytics, AI, People, Places, custom tags, advanced Timeline.
- **Risks or unknowns:** browser releases can regress storage; repeat compatibility tests for every frontend/runtime update.

## Definition of done

- A production user can create, edit, close, reopen after reload/restart,
  inspect, export, verify, erase deliberately, and re-import the same archive.
- Day/Week/Month/Year ordinary writing, stable-ID Events/Spans, Tracks, ongoing
  Spans, markers, ordered tags/display tag, and supported media work through
  `LifeArchiveClient`.
- The thin real ordinary slice passed before structured expansion; media landed
  only after reopen/recovery evidence.
- Timeline is bounded, read-only, retains empty periods, preserves logical
  position, and opens exact objects in Record without per-row persistence
  queries.
- Offline application/runtime assets are version-coherent and user archive
  content never appears in service-worker caches or `localStorage`.
- The public checkout builds/tests without the runtime, and production runtime
  absence is explicit with no mock fallback.
- The HTML reference hash is unchanged, unsupported concepts are absent, and
  desktop/tablet/mobile, light/dark, keyboard, reduced-motion, and screen-reader
  evidence is recorded.
- Public source is MPL-2.0; the runtime carries separate proprietary terms and
  notices; the combined application is not described as entirely open source.

## Product-owner input still required

1. Required browser/version matrix and whether a subset may ship if one engine
   cannot meet the complete persistence gate.
2. Acceptable user-visible archive transport when a browser cannot write an
   unpacked `.lifearchive` directory directly.
3. Runtime redistribution/licence terms for the self-host bundle.
4. Whether Life Details editing is required in the first web Settings surface.
5. Typed-name versus deliberate-dialog confirmation for Delete Archive.

Until answered, continue only non-dependent work against the explicit mock or
already proven runtime boundaries. Never fill these gaps with a second
persistence system or speculative product model.
