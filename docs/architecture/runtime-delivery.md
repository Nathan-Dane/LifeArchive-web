# Runtime delivery

How the compiled LifeArchive runtime reaches this repository, how it is pinned
and verified, how it is loaded, and how it behaves when it is missing.

Nothing described here is integrated yet. `runtime/runtime.lock.json` currently
records `"status": "not-integrated"`.

## Artifact contents

One runtime release is an immutable, versioned bundle containing:

- the compiled Wasm module built from the private Rust workspace;
- its JavaScript loader/glue module;
- TypeScript declarations for the generated surface (internal to the client
  module — see [`core-boundary.md`](core-boundary.md));
- a runtime manifest describing the release.

It contains no Rust source, no schemas, no contract specifications, and no
fixtures.

## Exact version pinning

The runtime is pinned to one exact version. Never a range, never `latest`,
never a moving branch or tag. `runtime/runtime.lock.json` is the single source
of truth for which version this checkout expects:

| Field | Meaning |
|---|---|
| `manifestVersion` | Format version of the lock file itself. |
| `runtimeVersion` | Exact runtime release version. |
| `artifactUrl` | Immutable location of that exact release. |
| `sha256` | Checksum of the artifact at that location. |
| `productContract` | Product application contract version implemented. |
| `bindingsAbi` | Binding/ABI version of the generated surface. |
| `status` | `not-integrated` until a real release is pinned. |

Changing any of these is a reviewed change to this repository, visible in the
diff.

## Checksum verification

The artifact is verified against `sha256` before it is used:

- at fetch time, by the script that downloads it — a mismatch aborts and leaves
  nothing installed;
- in CI, before any job that depends on the runtime;
- optionally at load time in the worker, where the platform makes the bytes
  available for hashing.

An unverified artifact is never loaded, and a checksum mismatch is a hard
failure. There is no "continue anyway" path.

## Runtime manifest format 1

Each release ships one canonical manifest with numeric `manifestVersion: 1`.
It contains the exact semantic runtime version, an opaque reproducible build
ID, exact product/ABI/dependency versions, the complete ordered web capability
inventory, bundle-relative module paths, and a SHA-256 digest for every payload
file. It also records factual `{ backend, durable }` persistence state, exact
worker/environment requirements, and separate proprietary licence and notices
paths.

The manifest is what compatibility and capability negotiation read. It is data
about the artifact — it is not a second copy of the contracts. Versions are
exact, never ranges or aliases. Capabilities and environment features are
ordered and duplicate-free. Module, licence, and notices paths must name
distinct hashed files inside the bundle.

The build ID never exposes a private commit SHA, branch, source path, lockfile
hash, or internal artifact identity. Private release validation scans payload
bytes for source paths. The public validator rejects an unsafe or incomplete
manifest before any runtime is instantiated.

## Worker loading

The runtime is instantiated in a dedicated worker, never on the main thread:

1. the app resolves the pinned artifact and its manifest;
2. the worker instantiates the Wasm module;
3. the worker exposes coarse, versioned request/response operations with
   correlation and cancellation;
4. `LifeArchiveClient` wraps that transport in an ergonomic API.

Keeping the runtime in a worker keeps store work, archive import/export, media
hashing, and verification off the UI thread, so writing and scrolling stay
responsive. Feature code never speaks to the worker directly.

The worker protocol uses generation-tagged control messages, lifetime-unique
request IDs, serialized admission, and transfer lists for `ArrayBuffer`
payloads. Startup has one `ready` or `fatal` outcome. Close is definitive and
normal termination happens only after it succeeds. Client cancellation never
abandons active work: only archive export/apply receives product cancellation,
and all active callers wait for a value result.

The canonical root ID is `lifearchive:archive-root:v1:primary`; its matching
origin-scoped ownership name is
`lifearchive:archive-lock:v1:primary`. Both are opaque identifiers, not paths.
The worker attempts exclusive ownership immediately before touching the root.
A second tab receives `already-open`, does not wait or take over, and cannot
open an alternate empty root. The UI remains unavailable until an explicit
retry succeeds.

The concrete browser lock API is intentionally undecided until the private
real-browser persistence proof. Whichever primitive is selected must acquire
the origin lock before runtime/filesystem handles and release it after
successful product close. Lock loss or worker crash requires same-root recovery
before a mutation can be retried.

## Capability negotiation

On open, the client negotiates before doing product work:

- it checks the manifest's product contract and bindings ABI against what this
  frontend build supports;
- it requires manifest format, runtime version, product contract, and ABI to
  equal the reviewed public lock exactly;
- an incompatible version fails clearly and explicitly — it is never coerced,
  guessed at, or partially used;
- a compatible runtime reports its named capabilities, and the frontend enables
  only the surfaces whose capabilities are present.

Absent capabilities disable features honestly. They are never emulated in
TypeScript.

## Production failure when unavailable

If the runtime is missing, fails its checksum, fails to instantiate, or fails
negotiation, a production build:

- surfaces an explicit, honest unavailable state;
- does not present an empty archive as if it were the user's archive;
- does not offer writing surfaces that cannot persist;
- does not fall back to mock content — ever, under any flag, in any build that
  a user could receive.

## Development-only mock mode

Development, tests, and previews may select a mock client implementing the same
`LifeArchiveClient` interface. Mock mode is:

- explicit — chosen deliberately, never entered by fallback;
- visible — the UI states that it is not a real archive;
- development-only — excluded from production builds;
- policy-free — it returns fixed values or records calls; it does not
  reimplement Rust-owned behaviour.

## Update flow

Once the runtime exists, updates flow one way, private → public:

1. private CI builds and validates a runtime release;
2. it publishes the immutable artifact and computes its checksum;
3. it opens a **pull request against this public repository** updating
   `runtime/runtime.lock.json` — version, URL, checksum, contract, ABI;
4. public CI fetches the pinned artifact, verifies the checksum, and runs the
   frontend checks against it;
5. a human reviews and merges.

The update is a reviewed public diff of a lock file. The private repository
never pushes directly to public branches, and public CI never gains
private-repository read access to perform it. See
[`repository-boundary.md`](repository-boundary.md).

## Self-host distributions

A complete self-host bundle may include the compiled runtime alongside the
frontend build. When it does, the runtime is included **under its own separate
proprietary licence** — it is not covered by the MPL-2.0 licence of this
repository's source, and such a bundle must not be described as entirely open
source. See [`NOTICE.md`](../../NOTICE.md).
