# Browser-local pilot operations and acceptance

This runbook is for the qualified, limited, browser-local LifeArchive pilot at
<https://lifearchive-web.pages.dev>. It does not expand the product claims
beyond the archive-lifecycle foundation described below.

## Release record

This table records the immutable production pair that completed every release
gate. A later change requires a new exact commit approval and acceptance run.

| Field | Candidate value |
|---|---|
| Stable HTTPS URL | `https://lifearchive-web.pages.dev` |
| Deployed public merge commit | `4ac50d8551c13926786269468b95195d188ae698` |
| User-approved production head contained by that merge | `b4fc9e923c91f6878cd48e8b0b75f67c938b32fb` |
| App version | `0.1.0` |
| Runtime version | `0.1.0` |
| Runtime artifact SHA-256 | `b7880b44395d48aecdfeb5b6e93bda0252aa2ecd06ce97f12d44c9875b52d613` |
| Runtime licence and notices | `LICENSE-RUNTIME.txt` and `NOTICES.md` are included in the immutable artifact; public distribution was authorized by the LifeArchive copyright holder on 2026-07-27 |
| Acceptance date and operator | `2026-07-28 Europe/Copenhagen (2026-07-27 UTC); coordinated by Codex and independently repeated by Agent C` |

Do not substitute a local development runtime, mutable URL, branch name,
preview deployment, or `latest` alias for these values.

## Supported pilot environment

The pilot support floor is:

- Chromium 137 or newer, desktop, regular browser profile.
- Firefox 153 or newer, desktop, regular browser profile.

Record the complete browser version for every result. A passing run qualifies
only the exact version tested; repeat the checklist after browser, frontend, or
runtime updates. Mobile, embedded browsers, private browsing, WebKit, and
non-regular storage modes are not supported by this pilot.

Use dedicated disposable acceptance profiles. Never point acceptance work at a
person's normal browser profile or real archive.

Firefox asks the user whether to allow persistent storage on first creation.
Answer that browser prompt deliberately. The application waits for the choice;
the grant reduces eviction risk but is not a backup.

## Data location and loss model

Archive data is local to the combination of browser origin, browser profile,
and device. A different scheme, host, port, profile, browser installation, or
device does not share that archive. Clearing site data, deleting the profile,
browser or operating-system cleanup, storage eviction, device loss, or storage
failure can destroy it. A browser persistence grant may reduce eviction risk;
it is not a backup.

Application updates stay on the permanent production hostname. They do not
migrate an archive to another hostname or make an archive available from a new
origin.

There is no account, sync, cloud copy, or recovery service. Make regular
verified exports and store them somewhere outside the browser profile. Keep at
least one earlier verified export until a newer export has been verified and
re-imported successfully.

Archive erase is permanent for the selected browser origin and profile. It must
not remove previously downloaded exports, but those files remain the
operator's responsibility.

## Current claim limits

This pilot runbook covers only archive lifecycle surfaces that are actually
present in the candidate. It makes no Record editor, writing capture, offline
operation, installation, service-worker, or PWA claim. Record and Timeline
must not be described as complete until their product acceptance work exists.

Do not enter real personal writing or media during acceptance. Use an approved
synthetic archive supplied outside the public repository. Do not publish that
archive, browser profile, downloaded export, trace, or screenshot unless it
has been reviewed as safe.

## Publication gate

All of the following must pass before the pilot candidate is published:

- The release record is complete and names one stable HTTPS deployment, one
  clean public commit, and one exact pinned runtime artifact.
- The public checkout passes `pnpm check` and `pnpm test:e2e` with the pinned
  Node and pnpm versions. Failures and skips are reviewed rather than hidden.
- The runtime lock, manifest identity, checksums, capabilities, app contract,
  and browser ABI agree exactly, and the reviewed artifact fetch succeeds.
- The production artifact check passes. The published frontend contains no
  development mock, test fixture, source map, archive/store material, local
  runtime receipt, private source, secret, or unreviewed executable.
- Publication and redistribution of the compiled runtime are explicitly
  licensed. Its separate proprietary licence and required third-party notices
  ship with the distribution; the combined application is not described as
  entirely open source.
- HTTPS, cross-origin isolation, worker loading, runtime CORS/resource policy,
  direct-route fallback, and immutable caching headers are verified on the
  deployed URL.
- A coherent, previously qualified frontend/runtime pair is available for
  same-origin rollback. A deployment must never mix versions from different
  pairs.
- Every checklist row below passes independently in both supported engines.

## Same-origin rollback

Rollback changes the coherent frontend/runtime asset pair, not the user's
archive location.

1. Stop new pilot admissions and preserve failure evidence.
2. Do not clear site data, delete a browser profile, erase an archive, change
   scheme/host/port, or move users to a replacement origin.
3. Restore a previously qualified frontend commit at the same origin whose
   tracked runtime pin is byte-for-byte identical to the current pin. If no
   such frontend exists, restore the previously qualified immutable
   frontend/runtime pair together; never combine unqualified versions.
4. Confirm the restored assets and checksums, then open the existing synthetic
   acceptance archive in a disposable profile.
5. If the previous pair cannot open the existing store, stop. Do not recreate
   or erase it. Restore the last pair that can open it and investigate before
   another release.
6. Roll forward only with a new immutable pair that has completed this
   checklist.

When the candidate is healthy enough to export, make and verify an export
before changing deployed versions.

## Deployed acceptance checklist

Run the full sequence independently in Chromium and Firefox. Use two new
disposable regular profiles, A and B, per engine. Every row requires an
explicit `PASS` or `FAIL` and an evidence reference. Evidence should contain
versions, timestamps, synthetic titles/counts, digests, and log references,
but never archive contents or profile data.

### Execution record

| Field | Recorded value |
|---|---|
| Engine and complete version | |
| Device and operating system | |
| Stable URL and origin | |
| Public commit/app version | |
| Runtime version/artifact SHA-256 | |
| Profile A disposable path or label | |
| Profile B disposable path or label | |
| Synthetic input name and SHA-256 | |
| Operator and start/end time | |

### Preconditions and observability

| ID | Required proof | Result (`PASS`/`FAIL`) | Evidence and notes |
|---|---|---|---|
| P1 | The release record is complete; the deployed app and runtime match it exactly. | | |
| P2 | The browser meets the engine/version/device/profile support floor, and the profile is newly created for acceptance. | | |
| P3 | The document is a secure context and is cross-origin isolated; required worker, storage, and locking capabilities are available. | | |
| P4 | The runtime becomes available without a development-mode notice, mock content, or a false saved/persistent claim. | | |
| P5 | Capture starts before first navigation for page errors, console errors and warnings, failed requests, HTTP failures, worker failures, and unexpected external origins. | | |

Treat an unexplained warning, failed request, unexpected origin, uncaught page
or worker error, mixed version, or mock marker as a failure.

### Routing

| ID | Required proof | Result (`PASS`/`FAIL`) | Evidence and notes |
|---|---|---|---|
| R1 | Direct navigation to `/` reaches `/record` without a server 404. | | |
| R2 | Direct navigation and reload succeed at `/record`, `/timeline`, `/settings`, and `/settings/archive`. | | |
| R3 | An unknown application path safely returns to `/record`; back/forward navigation and current-section state remain correct. | | |
| R4 | Route checks produce no new console, worker, network, or cross-origin failures. | | |

### Creation, identity, and restart durability

| ID | Required proof | Result (`PASS`/`FAIL`) | Evidence and notes |
|---|---|---|---|
| D1 | Profile A starts with no archive, offers deliberate creation only after runtime readiness, and creates one usable empty archive. | | |
| D2 | Settings reports runtime-derived storage state, health, zero counts, and the empty archive's identity presentation without implying backup or sync. | | |
| D3 | Importing the approved synthetic archive succeeds; the expected synthetic identity presentation and overview counts appear. | | |
| D4 | A full page reload reopens the same archive without selection or re-import and preserves the observed identity presentation and counts. | | |
| D5 | After all app windows and the browser process are closed, relaunching the same browser version with profile A reopens the same archive and preserves the observed identity presentation and counts. | | |
| D6 | A second tab cannot become a second writer; after the owning tab closes, an explicit retry safely reacquires the same archive. | | |

Record only identity values the public UI actually exposes. Do not infer hidden
stable identifiers from titles or counts.

### Export, verification, and import safety

| ID | Required proof | Result (`PASS`/`FAIL`) | Evidence and notes |
|---|---|---|---|
| T1 | Export completes through the deployed runtime and browser handoff as the expected `.lifearchive.tar`. Record its suggested filename, byte length, SHA-256, reported counts, and destination. | | |
| T2 | Standalone verification accepts the export. Identity presentation and overview counts recorded immediately before and after verification are unchanged. | | |
| T3 | A damaged duplicate of the export is rejected by verification without opening or mutating the active archive. Record unchanged before/after observations. | | |
| T4 | Importing the damaged duplicate fails without changing the active archive's identity presentation or counts. | | |
| T5 | Re-importing the valid export into profile A reports duplicates/no-op rather than overwriting existing stable records, and the observed identity presentation and counts remain correct. | | |
| T6 | No export or archive bytes appear in local storage or service-worker caches; downloaded files remain outside browser archive storage. | | |

Damage only a duplicate stored in the disposable acceptance workspace. Do not
interpret, unpack, or document the archive format.

### Profile isolation, erase, and restoration

| ID | Required proof | Result (`PASS`/`FAIL`) | Evidence and notes |
|---|---|---|---|
| I1 | With profile A still populated, new profile B at the same origin starts with no archive. Profile A's title or counts never appear in B. | | |
| I2 | Profile B creates an empty archive and imports the valid profile A export; expected identity presentation and counts appear after reload and full browser restart. | | |
| I3 | Before erase, profile B is confirmed disposable and the valid external export's filename, byte length, and SHA-256 are recorded. | | |
| I4 | Cancelling the erase confirmation changes nothing. A second deliberate confirmation erases only profile B and leaves a usable empty archive with zero counts and fresh identity presentation. | | |
| I5 | Reload and full browser restart preserve profile B's fresh empty state. The external export still exists with the same byte length and SHA-256. | | |
| I6 | Profile A still reopens with its original observed identity presentation and counts, proving profile B's import and erase did not cross profile boundaries. | | |
| I7 | Re-importing the saved valid export restores the expected synthetic identity presentation and counts in profile B, and another restart preserves them. | | |

If erase reports an unknown or incomplete durable outcome, stop. Preserve the
profile and follow the product's recovery path; do not repeat erase or clear
site data to force a result.

### Final console and evidence review

| ID | Required proof | Result (`PASS`/`FAIL`) | Evidence and notes |
|---|---|---|---|
| O1 | The complete run contains no unexplained page/worker exception, console error or warning, failed request, HTTP failure, mock marker, or unapproved network origin. | | |
| O2 | All exported files and browser profiles remain outside the repository and publication bundle; retained evidence contains no personal or private archive content. | | |
| O3 | Every prior row has an explicit result and evidence reference. Any failure blocks the candidate rather than being converted to a known issue after the run. | | |

### Completed production acceptance — 2026-07-28

The production pair was tested from clean disposable profiles on macOS 26.4
arm64. Only application-generated empty archives were used; no personal or
private archive content entered a profile, report, repository, or deployment.

| Evidence | Record |
|---|---|
| E1 | Coordinator Chromium report SHA-256 `ce228f78371992340a89e7b6b89a31cf578e697cf2928809824a2e1255865500`; Chromium `151.0.7922.34`; 2026-07-27 22:35:16–22:36:16 UTC |
| E2 | Coordinator Firefox report SHA-256 `5c2de192d16caeb4575bf02c07c4828d475d2d7502c5c8b0e786e5f10a11bc60`; Firefox `153.0`; 2026-07-27 22:40:47–22:41:52 UTC; Firefox's test-only prompt bypass made the explicit persistent-storage decision `allow` in disposable profiles |
| E3 | Independent Chromium report SHA-256 `756ac7f824017b6f0c36e0be9b08e2d93ebf3441057cdf341c7028d38e5cd5e0` and Firefox report SHA-256 `41f73bb7ee911a14b28e586eb79304970d00b1d2d94e3a8edaccedffff0ddf1e`; all lifecycle checks independently reproduced |
| E4 | Direct production HTTP recheck on 2026-07-27 22:43 UTC: all documented and unknown routes returned the same shell with direct `200`; required isolation/security headers were present; the runtime returned direct `200`, 1,788,455 bytes, immutable one-year caching, exact frontend CORS, and the recorded SHA-256 |

| Checklist rows | Result | Evidence and notes |
|---|---|---|
| P1–P5 | `PASS` | E1–E4. Exact app/runtime pair, supported engines, secure and cross-origin-isolated contexts, real runtime/no mock, and capture from first navigation. |
| R1–R4 | `PASS` | E1–E4. `/`, all named routes, reloads, and an unknown path returned the production shell directly; in-app routing and current sections were correct. |
| D1–D6 | `PASS` | E1–E3. Canonical empty archive creation, runtime-derived healthy/clean state with zero counts, reload and full-process restart durability, identity adoption on import, and exclusive-writer reacquisition all passed. |
| T1–T6 | `PASS` | E1–E3. Both engines exported a 6,656-byte `LifeArchive.lifearchive.tar`; five-file read-only verification passed; a byte-damaged duplicate was rejected by verification and import without mutation; valid re-import was a no-op; no archive bytes appeared in local storage, Cache Storage, or a service worker. |
| I1–I7 | `PASS` | E1–E3. A second profile began separate, imported and retained the first profile's valid export, preserved the external export through cancel and confirmed erase, retained its fresh state across restart, restored from export, and never changed profile A. |
| O1 | `PASS` | E1–E3. Zero console errors, page/worker errors, failed requests, HTTP failures, or unexpected origins. Firefox reports a repeated Wasm `try`/`try_table` deprecation warning on runtime instantiation; it is explained, does not indicate a failed runtime/storage/integrity operation, and is recorded rather than hidden. |
| O2–O3 | `PASS` | E1–E4. Disposable profiles, exports, and detailed reports remained outside Git and the publication bundle; every checklist row has a result and evidence reference. |

## Pilot decision

| Decision field | Recorded value |
|---|---|
| Chromium result and exact version | `PASS — 151.0.7922.34` |
| Firefox result and exact version | `PASS — 153.0`; known explained Wasm deprecation warning recorded above |
| Data-safety blockers | `None found` |
| Other blockers | `None for the stated archive-lifecycle scope` |
| Rollback pair rechecked | The production deployment history retains the qualified `4ac50d8551c13926786269468b95195d188ae698` frontend with Runtime `0.1.0` at SHA-256 `b7880b44395d48aecdfeb5b6e93bda0252aa2ecd06ce97f12d44c9875b52d613`; restore both as one pair at the same origin |
| Decision (`BLOCKED` or `LIMITED PILOT`) | `LIMITED PILOT` |
| Approver and date | Production head approved by the LifeArchive creator on `2026-07-28`; production acceptance completed the same day |

`LIMITED PILOT` means only the supported browser-local lifecycle described
here. It does not expand the current claim limits.
