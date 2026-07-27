# Runtime

This directory pins the compiled LifeArchive runtime that the web frontend
talks to. It currently pins nothing: `runtime.lock.json` records
`"status": "not-integrated"`.

Tracked here: `runtime.lock.json` and this README. Everything else in this
directory is a downloaded artifact and is ignored by Git.

The full delivery model is in
[`docs/architecture/runtime-delivery.md`](../docs/architecture/runtime-delivery.md).

## No Rust source belongs here

This directory holds compiled artifacts and their metadata only. Rust source,
SQLite schemas, contract specifications, fixtures, and operation vectors stay in
the private repository and must never be copied into this repository. See
[`docs/architecture/repository-boundary.md`](../docs/architecture/repository-boundary.md).

## Artifacts are immutable and versioned

One exact runtime version is pinned at a time — never a range, never `latest`,
never a moving tag. A published artifact is never edited in place; a change
means a new version and a new lock entry. Updating the pin is a reviewed diff
to `runtime.lock.json`.

## Checksums must be verified

The `sha256` in the lock file is verified before the artifact is used — on
fetch, in CI, and where the platform allows it, at load. A mismatch is a hard
failure that installs and loads nothing. There is no override.

The whole-bundle pin is separate from manifest format 1's per-file hashes.
`src/core/runtime/runtimeCompatibility.ts` validates both lock states, the
manifest shape and ordered capability inventory, and exact lock/manifest
identity compatibility. The current lock remains deliberately unpinned.

`pnpm runtime:fetch` is the only CI fetch path. With no pin it exits
successfully without using the network. With a reviewed pin it refuses
redirects, verifies the whole-archive checksum, archive allowlist, manifest
identity, and payload checksums, then installs into ignored
`runtime/installed/`. Any mismatch leaves no newly installed runtime.

At browser load, the pinned tar is fetched with cache bypass, whole-artifact
verified, and parsed as the exact approved ustar layout. Compatibility reads
the manifest extracted from those verified bytes, and the worker receives
short-lived object URLs made only from the matching extracted loader and Wasm.
It never selects separately hosted stable manifest or module URLs. A verified
in-memory extraction may be reused only under the exact artifact URL plus
whole-artifact SHA-256 identity; failed or partial verification is never
cached.

For a private/public sibling development workspace, a developer may install an
already packaged runtime without pretending it is a production pin:

```bash
pnpm runtime:install-local \
  ../LifeArchive/Shared/Rust/generated/web-release/lifearchive-runtime-web-0.1.0.tar.gz \
  ../LifeArchive/Shared/Rust/generated/web-release/lifearchive-runtime-web-0.1.0.tar.gz.sha256
pnpm run dev
```

The installer requires the exact checksum sidecar, then runs the same archive
allowlist, manifest identity, whole-bundle checksum, and per-file verification
as `runtime:fetch`. It writes only ignored files under `runtime/installed/`.
Development may consume the resulting verification receipt while the tracked
lock is still `not-integrated`; production builds never do. This is a real
runtime path, not mock selection and not a substitute for the reviewed Step 18
publication and pin.

## Runtime acceptance status

There is no repository-local production runtime acceptance evidence while the
tracked lock remains `not-integrated`. Playwright runs the qualified Chromium
151 and Firefox 153 engines and covers the production browser archive adapter,
but its archive output fixture simulates the runtime side of that handoff.
Those tests do not prove runtime instantiation, durable persistence, archive
format correctness, atomic application, or restart recovery.

After installing a licensed, verified local artifact as described above, an
opt-in smoke can establish only that artifact's machine-local development
loader instantiation and negotiation:

```bash
LIFEARCHIVE_LOCAL_RUNTIME_E2E=1 pnpm exec playwright test \
  e2e/local-runtime-smoke.spec.ts
```

The receipt and artifact remain ignored and unpublished. A passing local smoke
is not reproducible production acceptance and does not alter the tracked lock.

## Public UI builds must work without the runtime

A checkout of this repository alone, with no access to anything private, must
install, lint, typecheck, test, and build successfully with this directory
empty. The runtime is loaded at runtime, never linked at build time, and no
build step may require it to be present.

## Complete self-host bundles may include it

A complete self-host distribution may ship the compiled runtime next to the
frontend build. The runtime remains separate proprietary software under its own
licence; it is not covered by the MPL-2.0 licence of this repository's source.
See [`NOTICE.md`](../NOTICE.md).

## Production cannot silently use mocks

When the runtime is missing, unverified, or incompatible, a production build
fails clearly and says so. It never substitutes the development mock, never
presents an empty archive as the user's archive, and never offers writing
surfaces that cannot persist. Mock mode is explicit, visible, and
development-only.
