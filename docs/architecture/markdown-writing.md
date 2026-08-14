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

Final architecture and measurements replace this baseline section after the
engine migration.
