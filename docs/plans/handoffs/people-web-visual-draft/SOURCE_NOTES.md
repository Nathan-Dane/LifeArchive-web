# Current web source notes

These notes boil down the current public web implementation so the visual
prototype can stay recognisable without importing production React.

## Shell and responsive layout

- The top header is a warm, 64px surface with a serif `LifeArchive` brand, a
  small green `Local archive` state, horizontal main navigation, and controls
  for navigation/details panels when those panels collapse.
- The wide Record workspace has three regions: a 304px temporal/object
  navigation column, a flexible main writing region with a 620px minimum, and
  a 310px details region.
- Details becomes a focus-trapped drawer at 1120px. Navigation becomes a
  focus-trapped drawer at 820px. Compact overlays become bottom-aligned
  dialogs/drawers around 680px.
- Main destinations currently include Record, Timeline, People, and Settings.
  The approved direction makes Index first-class and places People under
  Index. Canonical route examples are `/index`, `/index/people`, and
  `/index/people/:personId`, plus the router's edit convention.

## Existing People web language

- The manager already uses a clear header, sticky local search, active and
  archived groups, calm identity rows, Load more, and a New Person action.
- Rows use circular photo/initials identity, name, primary connection, and last
  contact. The current detail/editor opens in a shared overlay, which the
  prototype may evolve into a responsive route-aware composition.
- The existing editor already groups identity, portrait controls, name,
  connections, About, other names, pronunciation, pronouns, partial life dates,
  references, derived insights/memories/contact, and management actions.
- The current Record People section already supports an absent section, Add
  Context, linked tiles, manage/clear/remove, revision-safe Undo, and an entry
  People manager. The planned Person context task card replaces its small
  radio-form modal and disconnected action menu.
- The approved linked-People presentation is role-weighted rather than a flat
  list: About/Together use prominent portrait tiles, Brief uses a labelled
  compact row group, and role-free Included people appear under `Also in
  entry`. Preserve the section total and adapt the number of columns to web
  width.

## Semantic design tokens

Use the variable names in `web-shell-template.html`. Core dark values are:

| Token | Value |
|---|---|
| page | `#0e0d0c` |
| warm | `#171510` |
| surface | `#201e19` |
| surface-alt | `#28251f` |
| raised | `#302c24` |
| details | `#15130f` |
| border | `#282520` |
| text-primary | `#f6f0e6` |
| text-secondary | `#c1b7a8` |
| text-tertiary | `#8f8576` |
| accent | `#ecb643` |
| accent-muted | `#c99b43` |
| accent-glow | `#ffd66b` |
| accent-on | `#14120d` |
| destructive | `#e98773` |
| success | `#9fbe7f` |
| note | `#8cacca` |

Radii are 8/10/12/16/20px plus pill; spacing steps are 4/6/8/12/16/24/32px.
The reading face is Georgia/Iowan/Times; interface controls use the system UI
stack. Keep text measures around 68ch rather than filling wide screens.

## Product boundaries

- Index is not a dashboard or a search substitute. No stats, recent activity,
  Places, or speculative metadata.
- Media content is out of scope. The Index card remains deferred and must not
  open the existing media storage/size-reduction page.
- Prototype state is illustrative and in-memory. Production durable writing is
  Markdown rather than HTML, and all real persistence belongs behind the
  compiled runtime—not JavaScript demo code.
- People opened from Record must reuse the canonical profile/editor and retain
  a trustworthy return path. The Record selection, unsaved writing buffer,
  scroll point, and focus are part of the return context.
- Do not weaken the public/private repository boundary or imply that the HTML
  is shippable implementation.
