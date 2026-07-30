# Semantic Material icon subset

`semanticCatalog.ts` is the single source of truth for the Material glyphs the
Record UI uses:

- `MATERIAL_ICON_BY_SEMANTIC_ID` maps every core semantic ID.
- `MATERIAL_UI_GLYPHS` lists picker controls and the unknown-ID fallback.

After changing either selection, run:

```bash
pnpm icons:update
pnpm check
```

The update command asks the Google Fonts CSS API for exactly the unique,
alphabetically sorted glyph names, then replaces the checked-in WOFF2 subset,
its checksum manifest, and a generated stylesheet under `src/assets/`. The
stylesheet embeds the small subset so base-path deployments need no separate
font request, and the deployed application makes no request to Google.

`pnpm icons:check` is part of the normal check gate. It performs no network
request; it verifies that the selected names, API URL, byte length, and SHA-256
still match the checked-in subset, and that the generated stylesheet contains
the exact checked-in font bytes.
