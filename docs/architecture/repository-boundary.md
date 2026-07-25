# Repository boundary

LifeArchive spans two repositories with different visibility, different
licences, and different authority. This document defines what lives where and
what may cross.

## The two repositories

```text
LifeArchive/          private · canonical
LifeArchive-web/      public  · this repository
```

- **`LifeArchive/` is private and canonical.** It holds the Rust workspace, the
  versioned contracts, schemas, fixtures and operation vectors, the native
  Apple platform code, and the product documentation. When it disagrees with
  anything here, it wins.
- **`LifeArchive-web/` is public.** It holds the web frontend source, its tests
  and tooling, and the documentation in this `docs/` tree.
- **They are sibling repositories, not submodules.** Neither is nested inside
  the other, neither is referenced as a Git submodule or subtree, and neither
  is checked out as a build dependency of the other. A typical working copy has
  them side by side in one workspace directory; that adjacency is a developer
  convenience with no build meaning.

## What stays private

The following never appear in this repository, in any form — not as source, not
as copies, not as paraphrases detailed enough to reconstruct them, and not in
commit messages, issues, or test fixtures:

- Rust source of any crate;
- SQLite schemas, migration SQL, and schema version history;
- private contract specifications, JSON schemas, canonical fixtures, and
  operation vectors;
- native platform source (Apple and any future native client);
- private product and engineering documentation.

Public documents may state *boundaries* — that mutations are revision-safe,
that civil dates are Rust-owned, that archive application is atomic. They must
not restate the normative rules that make those things true.

## Credentials

**Public workflows must receive no credentials capable of reading the private
repository.** Concretely:

- no private-repo tokens, deploy keys, SSH keys, or app installations in this
  repository's Actions secrets, environments, or workflow files;
- no workflow step that clones, fetches, or calls the private repository's API;
- no cross-repository triggers that would run untrusted public-side code with
  private-side permissions;
- pull-request workflows from forks get no secrets at all.

The trust flows one way: the private repository may push to the public one; the
public one can never read back. A public CI job that could read private source
would make the boundary decorative.

## What may cross

**Only compiled, versioned runtime artifacts cross the boundary**, together
with the metadata needed to identify and verify them:

- a compiled Wasm module and its loader/type surface;
- an exact version, a checksum, and the contract/ABI versions it implements.

Nothing else. No source, no schemas, no fixtures. See
[`runtime-delivery.md`](runtime-delivery.md) for how artifacts are pinned,
verified, and updated.

## Licensing

**Public source and proprietary runtime have separate licences.** The frontend
source in this repository is MPL-2.0. The compiled LifeArchive runtime is
separate proprietary software and is not covered by that licence. A complete
distribution may contain both, each under its own terms. See
[`NOTICE.md`](../../NOTICE.md).

## Independence requirement

**A public frontend checkout must still build and test without the proprietary
runtime.** Someone who clones only this repository, with no access to anything
private, must be able to run install, lint, typecheck, test, and build
successfully.

This is a hard constraint on how the frontend is written:

- the runtime is loaded at runtime, never linked at build time;
- no build step requires the artifact to be present;
- tests run against the development mock or fixed values, behind the same
  `LifeArchiveClient` interface;
- absence of the runtime is a well-defined, tested state — not a crash and not
  a silent mock substitution in production.
