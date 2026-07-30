# Cloudflare release operations

How to publish a coherent LifeArchive Web frontend/runtime pair to Cloudflare
Pages, including the manual path when GitHub Actions is unavailable.

This runbook does not replace the acceptance checklist in
[`browser-local-pilot.md`](browser-local-pilot.md). It explains how to move
already authorized and verified bytes into production. A release is not
qualified merely because these commands succeed.

## Fixed production resources

| Purpose | Cloudflare Pages project | Stable origin |
|---|---|---|
| Public frontend | `lifearchive` | `https://lifearchive-web.pages.dev` |
| Immutable runtime releases | `lifearchive-runtime` | `https://lifearchive-runtime.pages.dev` |

Keep the frontend on its stable origin. Browser archive data is origin-scoped,
so a preview deployment is useful for inspection but is not a substitute
production origin.

## Release invariants

- Publish a new runtime version for any new runtime bytes. Never overwrite a
  previously published version.
- Publish and verify the runtime before merging the frontend lock that names
  it.
- Deploy the frontend and runtime as one reviewed pair. Never combine a
  frontend with an unqualified runtime pin.
- Cloudflare Pages directory uploads are complete snapshots. A runtime upload
  must include every older release that must remain available for current
  consumers or rollback.
- Only compiled runtime artifacts, their checksum sidecars, licence, notices,
  and manifest metadata cross the private/public boundary. Never stage private
  source or documentation in this repository.
- Treat Cloudflare deployment metadata as orientation, not proof. Verify the
  stable hostname, exact shipped assets, headers, and live runtime negotiation.

## Authenticate without repository secrets

Use a local Cloudflare OAuth session when a workflow cannot perform the
release:

```bash
npx wrangler login
npx wrangler whoami
npx wrangler pages project list
```

Confirm that the authenticated account contains both projects above before
uploading. Wrangler may create a local `.wrangler/` cache; it is deployment
state, not source, and must not be committed.

Do not place Cloudflare tokens, OAuth output, account configuration, or
generated deployment caches in either repository.

## 1. Prepare and verify the runtime privately

Runtime source, packaging, conformance, licence authorization, and release
version selection happen in the private repository. This public checkout
should receive only:

```text
lifearchive-runtime-web-<version>.tar.gz
lifearchive-runtime-web-<version>.tar.gz.sha256
```

Before publication, record:

- the exact semantic runtime version;
- the whole-archive SHA-256 from the sidecar;
- `manifestVersion`, `productContract`, and `bindingsAbi` from the packaged
  manifest;
- the fact that publication and redistribution of that artifact are
  authorized.

The artifact URL is:

```text
https://lifearchive-runtime.pages.dev/releases/<version>/lifearchive-runtime-web-<version>.tar.gz
```

Do not use `latest`, a redirect, a branch name, or a query-qualified URL.

### Do not confuse the Pages fallback with an existing artifact

The runtime project has an informational root page. A missing path can
therefore return HTML with HTTP `200`. Status alone does not prove that a
version already exists. Check content type, byte size, and checksum:

```bash
curl -sS -I "$artifact_url"
curl -fsSL "$artifact_url" | shasum -a 256
```

A real archive response must be gzip bytes whose digest equals the reviewed
sidecar. HTML, a small response, or any other digest is not the artifact.

## 2. Publish the immutable runtime snapshot

Create a temporary deployment directory outside tracked source. It must
contain the new artifact and sidecar under `releases/<version>/`, plus every
older release that must remain served:

```text
runtime-pages/
├── _headers
├── index.html
└── releases/
    ├── <previous-version>/
    │   ├── lifearchive-runtime-web-<previous-version>.tar.gz
    │   └── lifearchive-runtime-web-<previous-version>.tar.gz.sha256
    └── <version>/
        ├── lifearchive-runtime-web-<version>.tar.gz
        └── lifearchive-runtime-web-<version>.tar.gz.sha256
```

Use this `_headers` rule. The final `*` is intentional: it matches all nested
versioned release files.

```text
/releases/*
  Access-Control-Allow-Origin: https://lifearchive-web.pages.dev
  Cache-Control: public, max-age=31536000, immutable
  Cross-Origin-Resource-Policy: cross-origin
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
```

Deploy the complete directory:

```bash
npx wrangler pages deploy <runtime-pages-directory> \
  --project-name lifearchive-runtime \
  --branch main \
  --commit-message "Publish immutable web runtime <version>"
```

Wrangler returns a deployment-specific URL. Verify it first, then the stable
runtime origin after alias propagation:

```bash
curl -fsSL "$artifact_url" | shasum -a 256
curl -fsSL "$artifact_url.sha256"
curl -sS -I -H 'Origin: https://lifearchive-web.pages.dev' "$artifact_url"
```

Required response evidence:

- the archive and sidecar contain the reviewed digest;
- `Access-Control-Allow-Origin` names the stable frontend origin;
- `Cache-Control` contains `max-age=31536000, immutable`;
- `Cross-Origin-Resource-Policy` is `cross-origin`;
- the previous supported runtime URL still returns its original bytes.

The stable alias may lag a deployment-specific URL briefly. Do not update the
frontend pin until the stable artifact URL itself passes.

## 3. Pin the release in the public repository

Update `runtime/runtime.lock.json` with the exact version, URL, whole-archive
SHA-256, product contract, bindings ABI, and `pinned` status. Update exact pin
assertions in `src/core/runtime/runtimeLock.test.ts`. If the manifest dependency
profile changed, update `runtime/web-runtime-policy.json` deliberately rather
than weakening validation.

Run:

```bash
pnpm runtime:fetch
pnpm check
pnpm test:e2e
```

For a packaged local artifact, also install and exercise the real runtime:

```bash
pnpm runtime:install-local <artifact.tar.gz> <artifact.tar.gz.sha256>
VITE_LIFEARCHIVE_CLIENT=local-runtime \
  LIFEARCHIVE_LOCAL_RUNTIME_E2E=1 \
  pnpm exec playwright test e2e/local-runtime-smoke.spec.ts
```

Review every failure and skip. Never remove or weaken a test to make the
release pass, and never describe a stale locator as product proof. Record any
unresolved acceptance limitation in the pull request and release evidence.

The public default branch is protected. Push a release branch, open a pull
request, and merge through the repository's approved authority. If Actions
usage is unavailable, provide the complete local evidence on the pull request;
do not disable branch rules or add private credentials to public CI.

## 4. Build and upload the exact merged frontend

After the pin pull request is merged, build from the exact public `main`
checkout that will be associated with the deployment:

```bash
git switch main
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm runtime:fetch
pnpm check
pnpm build
pnpm safety:production
public_sha="$(git rev-parse HEAD)"
```

`pnpm safety:production` must confirm that `dist/` contains the expected app
and runtime versions and contains no mock, local runtime, source map, fixture,
archive, store, or unversioned executable material.

Cloudflare's Git integration is independent of GitHub Actions, but do not rely
on it as the only publication mechanism when workflow or build state is
uncertain. Upload the verified directory directly:

```bash
npx wrangler pages deploy dist \
  --project-name lifearchive \
  --branch main \
  --commit-hash "$public_sha" \
  --commit-message "Deploy verified frontend with runtime <version>"
```

Do not deploy a preview-branch build to the stable origin. Do not attach a
commit hash whose tree differs from the built `dist/`.

## 5. Verify production, not just the deployment record

`wrangler pages deployment list --project-name lifearchive` is useful, but an
`Active` row is not sufficient. A build can appear there while its
deployment-specific URL returns `404`, or while the stable hostname still
serves an older bundle.

Verify all of the following:

1. `/`, `/record`, `/timeline`, `/settings`, and `/settings/archive` return
   `200` with the app shell.
2. The stable `index.html` names the expected hashed JavaScript and CSS assets.
3. The remote hashed assets are byte-identical to the local `dist/` assets.
4. The shipped JavaScript contains the exact runtime version and checksum.
5. The frontend response has:
   - `Cross-Origin-Embedder-Policy: require-corp`;
   - `Cross-Origin-Opener-Policy: same-origin`;
   - `Cross-Origin-Resource-Policy: same-origin`;
   - `X-Content-Type-Options: nosniff`;
   - `Referrer-Policy: no-referrer`.
6. A clean supported browser reaches runtime-backed first-run or the existing
   archive without a mock/development notice, failed runtime request, console
   error, or false persistence claim.

Useful read-only checks:

```bash
for route in / /record /timeline /settings /settings/archive; do
  curl -sS -o /dev/null -w "$route %{http_code} %{content_type}\n" \
    "https://lifearchive-web.pages.dev$route"
done

curl -sS -I https://lifearchive-web.pages.dev/
curl -fsSL "$artifact_url" | shasum -a 256
```

Inspect the stable page's actual asset names before comparing local and remote
digests. Vite filenames can differ across toolchain versions even for similar
source, so the deployed bytes—not a guessed filename—are authoritative.

## Rollback

Rollback must preserve the stable frontend origin and restore a coherent,
previously qualified frontend/runtime pair. Redeploy the earlier frontend
artifact whose tracked lock names the earlier immutable runtime. Do not delete
runtime releases, change archive origin, clear browser data, or mix an older
frontend with a newer runtime.

After rollback, repeat stable-route, asset, header, runtime checksum, and live
browser verification.

## Cleanup

Remove only the temporary deployment snapshot and Wrangler caches created for
the release. Preserve unrelated worktree changes. Before finishing, confirm
both repositories are on `main`, match `origin/main`, and contain no accidental
runtime bytes, credentials, `.wrangler/` state, or release staging directories.
