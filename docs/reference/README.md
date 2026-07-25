# Visual reference

This directory preserves visual and interaction references for LifeArchive Web.
It is documentation, not part of the application build.

## `record-v0.1.0.html`

A self-contained HTML mock of the responsive Record workspace, kept exactly as
it was supplied.

### What it is

- A **visual and interaction reference**: layout, hierarchy, spacing, colour
  tokens, drawer behaviour, expandable calendar, appearance switching, and
  responsive breakpoints.

### What it is not

- **It is not production code.** Nothing in it ships. Its markup, CSS, IDs, and
  inline script must not be copied, imported, extracted, or wrapped into React
  components.
- **It is not a persistence specification.** It performs no storage of archive
  content and makes no claim about how anything is saved.
- **It is not a domain specification.** The objects, fields, labels, and states
  it shows are illustrative. It does not define entries, Events, Spans, Tracks,
  tags, markers, revisions, or media ownership.

### Authority

The Rust contracts in the private `LifeArchive` repository and the current
product documentation **override this file** wherever they disagree with it.
Where the mock shows something the current contracts do not support, the
contracts win and the affordance is not built. See
[`docs/product/web-v0.1.0-scope.md`](../product/web-v0.1.0-scope.md) for the
approved, referenced, and unapproved lists.

### Rules for agents and contributors

- Production components must be **newly structured** — designed as React
  components with their own state ownership, accessibility, and localisation —
  rather than derived from this file's DOM.
- This file must **remain unchanged**, byte for byte, so later work can be
  compared against the original. Do not reformat, prettify, lint, minify,
  translate, or "fix" it.
- It is excluded from formatting and linting tooling. If a tool wants to
  rewrite it, exclude the file rather than accepting the rewrite.
- Superseding references are added as new files with new version names; they do
  not replace this one.

### Integrity

SHA-256 of `record-v0.1.0.html`:

```text
f54e344b53dce40733e3623fd7ae553bc81d047aa0e01fad743da25115101329
```

Verify with:

```bash
shasum -a 256 docs/reference/record-v0.1.0.html
```
