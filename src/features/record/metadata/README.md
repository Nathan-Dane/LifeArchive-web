# Semantic Material icon subset

`semanticIconCatalog.generated.ts` is the committed public value snapshot of
the Rust-owned semantic catalogue: version, defaults, category order, and icon
order. It is generated during a coordinated private release and deliberately
contains no private source path, revision, contract fixture, glyph name, or
localized label. The public build never reads a private checkout.

`semanticCatalog.ts` is the handwritten web presentation adapter:

- `MATERIAL_ICON_BY_SEMANTIC_ID` maps every core semantic ID.
- `MATERIAL_UI_GLYPHS` lists picker controls and the unknown-ID fallback.

When a coordinated release changes the generated snapshot, its TypeScript
`satisfies` check and metadata tests require complete glyph coverage. Review
the generated value diff, update the web-only mapping and localized names, then
refresh the font subset. Normal public CI validates the committed snapshot
independently; it never regenerates it.

After changing either selection, run:

```bash
pnpm icons:update
pnpm check
```

The update command asks the Google Fonts CSS API for exactly the unique,
alphabetically sorted glyph names, then replaces the checked-in WOFF2 subset,
its checksum manifest, and a generated stylesheet under `src/assets/`. The
stylesheet references that bundled font asset so the deployed application
makes no request to Google and the font is emitted once as a cacheable file.

`pnpm icons:check` is part of the normal check gate. It performs no network
request; it verifies that the selected names, API URL, byte length, and SHA-256
still match the checked-in subset, and that the generated stylesheet references
the checked-in font asset.
