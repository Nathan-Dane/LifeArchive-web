# Markdown writing architecture

LifeArchive keeps an Entry's UTF-8 Markdown string as its only durable writing
representation. The browser editor and every complete-body reader must share
one semantic decoder; HTML and editor state are temporary presentation values
only.

## Lexical production baseline

The pre-migration production build was measured with the repository-pinned
Node 24.18.0 and pnpm 11.17.0. Vite 8.1.5 produced the minified build. Gzip
uses level 9 and Brotli uses quality 11. Sizes are the sum of independently
delivered files, matching transfer behavior.

| Delivery boundary | Unminified | Minified | Gzip | Brotli |
|---|---:|---:|---:|---:|
| Initial application JavaScript | 1,488,698 B | 757,022 B | 202,955 B | 175,221 B |
| Initial application CSS | 215,337 B | 178,453 B | 25,584 B | 21,575 B |
| Editor-open marginal JavaScript | 395,027 B | 282,780 B | 87,504 B | 74,933 B |

The initial boundary includes the HTML entry's complete static JavaScript
import closure. The editor boundary is the lazy `MarkdownWritingSurface` chunk;
its shared imports are already present in the initial closure. The Record route
itself is part of the initial entry chunk and has no separate route chunk.

The baseline production assets affected by the editor are:

| Asset | Minified | Gzip | Brotli |
|---|---:|---:|---:|
| `index-BYz0HvVP.js` | 484,065 B | 128,383 B | 110,280 B |
| `rolldown-runtime-QTnfLwEv.js` | 694 B | 422 B | 373 B |
| `i18n-CjY0n3Ej.js` | 101,355 B | 26,852 B | 23,028 B |
| `overlay-DwxBxBhW.js` | 10,186 B | 3,662 B | 3,239 B |
| `chunk-KS7C4IRE-CZ2J-A4u.js` | 42,628 B | 15,106 B | 13,542 B |
| `metadata-BsZHZF1a.js` | 23,948 B | 8,325 B | 7,309 B |
| `people-B6gVw-pw.js` | 94,146 B | 20,205 B | 17,450 B |
| `index-NmcD5X8o.css` | 160,895 B | 22,155 B | 18,588 B |
| `people-DsZ6ja8i.css` | 17,558 B | 3,429 B | 2,987 B |
| `MarkdownWritingSurface-Duqv2KoP.js` | 282,780 B | 87,504 B | 74,933 B |

## Production architecture

`bodyMarkdown` remains the only durable writing value. The production flow is:

```text
bodyMarkdown -> decodeMarkdown -> safe semantic DOM -> Pell/contenteditable
             -> decodeEditorDom -> encodeMarkdown -> revision-safe autosave
```

The dependency-free codec in `src/features/markdown/markdownCodec.ts` owns the
semantic document, block and inline scanners, canonical encoder, safe DOM
renderer, editor-DOM decoder, and link policy. `MarkdownWritingSurface` lazy
loads Pell as an empty action bar and uses only its contenteditable command
adapter; application components continue to own the toolbar, selection,
overlays, styling, autosave, revision, conflict, and navigation boundaries.
Pell's CSS and unsupported actions are not imported.

Complete-body readers use `MarkdownBody`, which lazy loads the same codec. No
reader grammar, raw-Markdown fallback, HTML persistence, editor state, generic
Markdown dependency, or second sanitizer is present.

### Supported dialect

The semantic contract is deliberately limited to the iOS feature set:

| Inline | Canonical source |
|---|---|
| Bold, italic | `**bold**`, `*italic*` |
| Underline, strikethrough | `<u>underline</u>`, `~~strike~~` |
| Link | `[label](https://example.com)` |
| Inline code | A backtick delimiter longer than its content's longest run |

| Block | Canonical source |
|---|---|
| Paragraph and visible line break | Plain text and source newline |
| Heading and subheading | H1 and H2; H3-H6 input normalizes to H2 |
| Lists | `-` or ordinal markers; nesting uses four spaces |
| Quote and divider | `>` and standalone `---` |
| Fenced code | Backtick fence longer than its content, with optional language |

A standalone `---` always starts a divider, and the first non-empty unquoted
line ends a quote, except inside a fence. Ordered starts, mixed nested list
kinds, code languages, Unicode, combining sequences, and emoji ZWJ sequences
remain semantic data. Images, tables, task lists, arbitrary HTML, footnotes,
colour, highlighting, alignment, and every other extension remain ordinary
text or are removed from pasted DOM.

Only reconstructed `p`, `br`, `strong`, `em`, `u`, `del`, safe `a`, `code`,
`h1`, `h2`, `ul`, `ol`, `li`, `blockquote`, `hr`, and `pre > code` nodes reach
the editor. Rich paste passes through the same DOM decoder and renderer. The
link allowlist retains the established HTTP(S), mail, same-origin, and bare
domain behavior while rejecting unknown schemes, malformed destinations,
control-character obfuscation, and encoded unsafe protocols.

Composition never emits an intermediate value. Normal input observes the DOM
without rebuilding it, save acknowledgements do not reinstall it, and clean
external revisions use the existing generation-aware install path. Toolbar
pointer handling saves the selection; link changes are applied only after the
overlay closes. Browser-specific visual format-off spans are reduced back to
semantic tags without treating CSS as Markdown.

The editor command surface uses the generated local Material Symbols subset;
`editorMaterialGlyphs.ts` is the single source for the toolbar and format-menu
glyph names and for the subset updater. The toolbar remains one horizontal,
touch-scrollable row as its container narrows, so no command disappears and
the writing surface does not change height. At 820 px, list and indentation
commands move into one menu. At 680 px, underline, strikethrough, inline code,
and link move into a second menu after Italic. At 480 px, the format trigger
collapses from icon plus label to icon plus chevron. Accessible names and
labelled menus remain available at every stage, keyboard focus scrolls hidden
commands into view, and one-pixel separators preserve command-group
boundaries. Quote is available only in the format menu, where a divider
separates paragraph and heading styles from quote and code-block styles.

## Final production measurement

The final build uses the same Node, pnpm, Vite, compression settings, and
independently delivered-file accounting as the baseline.

| Delivery boundary | Unminified | Minified | Gzip | Brotli |
|---|---:|---:|---:|---:|
| Initial application JavaScript | 1,489,690 B | 757,706 B | 202,914 B | 175,374 B |
| Initial application CSS | 218,291 B | 180,972 B | 26,087 B | 21,987 B |
| Editor-open marginal JavaScript | 81,320 B | 43,989 B | 13,732 B | 12,436 B |

The Record route remains in the initial entry and has no separate route chunk.
The editor-open boundary is the `MarkdownWritingSurface` and single shared
`markdownCodec` chunk after subtracting the initial static closure.

| Boundary delta from Lexical | Unminified | Minified | Gzip | Brotli |
|---|---:|---:|---:|---:|
| Initial application JavaScript | +992 B (+0.1%) | +684 B (+0.1%) | -41 B (-0.0%) | +153 B (+0.1%) |
| Initial application CSS | +2,954 B (+1.4%) | +2,519 B (+1.4%) | +503 B (+2.0%) | +412 B (+1.9%) |
| Editor-open marginal JavaScript | -313,707 B (-79.4%) | -238,791 B (-84.4%) | -73,772 B (-84.3%) | -62,497 B (-83.4%) |

The final affected assets are:

| Asset | Minified | Gzip | Brotli |
|---|---:|---:|---:|
| `index-De16EYx7.js` | 484,242 B | 128,140 B | 110,176 B |
| `jsx-runtime-KJkY8l8U.js` | 8,535 B | 3,268 B | 2,918 B |
| `menu-B2YfbgDb.js` | 13,810 B | 4,868 B | 4,346 B |
| `i18n-BuwE_ojU.js` | 94,083 B | 24,048 B | 20,639 B |
| `chunk-KS7C4IRE-C1e7g42w.js` | 42,591 B | 15,100 B | 13,520 B |
| `metadata-CqvJZrwd.js` | 20,317 B | 7,258 B | 6,350 B |
| `people-1N9VzaQH.js` | 94,128 B | 20,232 B | 17,425 B |
| `MarkdownWritingSurface-z5msMLJk.js` | 32,461 B | 9,449 B | 8,481 B |
| `markdownCodec-D5RgCcFk.js` | 11,528 B | 4,283 B | 3,955 B |
| `MarkdownBody-ibDRX6Gn.js` | 362 B | 280 B | 239 B |
| `index-DfZ0bAHJ.css` | 163,414 B | 22,640 B | 19,000 B |
| `people-DsZ6ja8i.css` | 17,558 B | 3,447 B | 2,987 B |
| `material-symbols-rounded-subset-DavaRBP6.woff2` | 29,836 B | 29,864 B | 29,835 B |

The Vite manifest contains one codec chunk shared by editor and reader. The
production manifest, emitted JavaScript, source maps, package manifest, and
lockfile contain no `lexical` or `@lexical/*` package source. Pell 1.0.6 is the
only added runtime dependency and its MIT notice is retained in `NOTICE.md`.

## Qualification evidence

The codec golden corpus asserts Markdown-to-semantics, semantics-to-Markdown,
Markdown-to-editor-DOM, and editor-DOM-to-Markdown stability for every supported
feature and security boundary. The focused codec/editor suite has 46 passing
tests; the full Vitest suite has 752 passing tests.

The editor compatibility suite passes on Chromium 151, Firefox 153, WebKit
26.5 desktop, and WebKit 26.5 with the iPhone 15 mobile profile. It covers
format on/off and mixed nesting, clear formatting, link create/edit/remove,
focus restoration, native undo/redo, block transitions, list depth and kind,
divider insertion, composition, and hostile rich paste. WebKit qualification
is editor-specific and does not change the separate archive-persistence browser
admission policy.
