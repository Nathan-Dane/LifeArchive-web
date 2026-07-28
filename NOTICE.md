# Notices

LifeArchive Web is distributed as two components with different licences.

## 1. Public frontend source — MPL-2.0

The source code in this repository is licensed under the **Mozilla Public
License, version 2.0**. The full text is in [`LICENSE`](LICENSE), and is also
available at <https://mozilla.org/MPL/2.0/>.

This covers the application source, tests, tooling, and documentation in this
repository — including the visual reference in `docs/reference/`.

### Material Symbols

The frontend contains a subset of the Material Symbols Rounded font generated
through the Google Fonts CSS API. Material Symbols are licensed under the
Apache License 2.0, available at
<https://www.apache.org/licenses/LICENSE-2.0>. The subset is checked into this
repository and served by the application; the deployed frontend makes no
request to Google Fonts.

## 2. Compiled LifeArchive runtime — separate proprietary software

The compiled LifeArchive runtime (the Wasm module built from the private
LifeArchive Rust workspace, together with its loader and generated type
surface) is **separate proprietary software**. It is **not** licensed under
MPL-2.0 and is **not** covered by [`LICENSE`](LICENSE).

**The runtime source is not part of this repository.** It lives in the private
`LifeArchive` repository. Only compiled, versioned artifacts cross that
boundary, pinned by [`runtime/runtime.lock.json`](runtime/runtime.lock.json).
No runtime artifact is currently integrated.

The runtime is governed by its own separate licence terms, supplied with the
runtime itself. No proprietary runtime licence text is included here, because
none has been supplied.

## 3. Combined distributions

A complete distribution of LifeArchive Web — for example a self-host bundle —
may include **both** components: the MPL-2.0 frontend build and the proprietary
compiled runtime. Each component remains under its own respective licence in
such a distribution. Including them together does not relicense either one.

## 4. No open-source claim for the combined application

**No legal claim should be made that the complete combined application is
entirely open source.**

The frontend source is open source under MPL-2.0 and may accurately be
described as such. The complete application, which depends on the proprietary
runtime for all durable behaviour, is not. Do not describe the combined product
as open source, free software, or fully source-available in documentation,
release notes, marketing, package metadata, or repository descriptions.
