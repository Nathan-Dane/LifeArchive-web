# People visual reference set

These screenshots document the current native People implementation for the
web visual-design pass. References 01–21 were captured on an iPhone 17
simulator running iOS 26.5, in dark mode, on 13 August 2026; every Person and
archive in those captures is synthetic UI-test data. The additional user-supplied composition reference is kept outside public Git
because it contains personal names and portraits. Its hierarchy is described
below without reproducing that data.

Use the set to preserve recognizable hierarchy, grouping, terminology, and
interaction state. Do not copy iOS dimensions, tab bars, navigation bars,
keyboards, gestures, or sheet mechanics into the web UI. The web implementation
must use its existing dark-theme tokens and the web-native routing, overlay,
focus, and responsive behaviour specified in the
[People parity plan](../../people-feature-parity-plan.md).

## What should feel familiar

- Index presents People, Tracks, and the deferred Media card as peers. People
  is an archive-wide destination; Record People remains entry-specific.
- People browsing uses a strong page title, persistent search, calm grouped
  cards, circular photo/initial identity, and restrained secondary labels.
- Person view and edit share the same prominent identity hero. Editing adds the
  photo control, inline name field, connection controls, About, and grouped
  details. Viewing replaces editing affordances with derived contact and
  history content.
- Interaction roles retain the order `Included`, `Brief`, `Together`, `About`.
  Selected roles use both a checkmark and a surface change, never colour alone.
- A linked Person in Record opens a focused task card: identity hero without
  life dates, the shared role controls, then View, Edit, and destructive Remove.
- Destructive actions remain visually separated and use the established danger
  treatment. Mutating states should keep the surrounding task context stable.

## Web translation notes

- Replace native tab and navigation chrome with the web shell, canonical URLs,
  browser history, and a visible breadcrumb/back affordance.
- On wide screens, use the established anchored overlay/dialog language and
  take advantage of horizontal room without stretching cards excessively. On
  compact screens, a focus-trapped drawer or dialog may closely resemble the
  native composition.
- Keep reading widths intentional. A desktop People directory may use a wider
  list or a master/detail composition, while profile/editor content should
  remain comfortably readable rather than filling the viewport.
- Web form controls may wrap, grid, or horizontally scroll at narrow widths,
  but preserve field grouping and role order. Do not reproduce the iOS keyboard
  or wheel picker; use accessible web-native inputs with equivalent precision.
- The screenshot accent is illustrative of the selected archive accent. Bind
  the implementation to existing web semantic tokens instead of sampled
  colours from the PNG files.
- Media is represented only to establish Index hierarchy. It must not navigate
  to the storage/size-reduction manager, and its content remains out of scope.

## Screenshot inventory

### Index and People directory

| Reference | Design evidence |
|---|---|
| [01 — Index overview](01-index-overview.png) | Main hierarchy, peer cards, icon/title/description rhythm, deferred Media state. |
| [02 — Empty People directory](02-people-empty-directory.png) | Back/manage/add controls, search placement, empty-state card and primary action. |
| [06 — Populated People directory](06-people-populated-directory.png) | Section heading, single-row identity card, initials, name, and disclosure affordance. |
| [07 — People manage mode](07-people-manage-mode.png) | Manage-to-Done toolbar state while directory context remains stable. |

### Creation, profile, and editor

| Reference | Design evidence |
|---|---|
| [03 — Create Person prompt](03-create-person-prompt.png) | Lightweight first step, required name, optional connection, disabled Create state. |
| [04 — Person editor top](04-person-editor-top.png) | Editable identity hero, photo action, serif identity name, connections, About grouping. |
| [05 — Person profile top](05-person-profile-top.png) | Read-only identity hero and the first derived profile section. |
| [08 — Connection selection](08-connection-selection.png) | Multi-select list hierarchy, explanatory copy, standard and custom connections. |
| [09 — Person editor details](09-person-editor-details.png) | Compact other-name row, remove action, pronunciation, pronouns, and life-status grouping. |
| [10 — Person date selector](10-person-date-selector.png) | Year/month/day precision choices and contextual date editing; translate to web-native controls. |
| [19 — Profile contact section](19-person-profile-contact-section.png) | Empty recorded-contact state and Log Contact action. |
| [20 — Log Contact picker](20-log-contact-interaction-picker.png) | Focused date-plus-interaction task with no separate save button. |
| [21 — Contact recorded](21-person-profile-contact-recorded.png) | Derived summaries, careful explanatory copy, history action, success notice, and Undo. |

### People in Record

| Reference | Design evidence |
|---|---|
| [11 — Empty Record People manager](11-record-people-manager-empty.png) | Contextual overlay hierarchy, empty result, quick creation, and anchored search. |
| [12 — Unassigned Person](12-record-people-manager-unassigned.png) | `Other people` group, identity handoff, and the shared four-role control row. |
| [13 — Assigned Person](13-record-people-manager-assigned.png) | `In this entry` group and selected-role treatment after the mutation settles. |
| [14 — Linked Person section](14-record-linked-person-section.png) | Compact Record grouping, role heading, linked row, add/menu controls, and surrounding context. |
| [15 — Context card: Brief](15-record-person-context-card-brief.png) | Large identity hero without life dates, selected Brief role, and primary action list. |
| [16 — Context card: Together](16-record-person-context-card-together.png) | In-place interaction change while card identity and actions remain stable. |
| [17 — Context card actions](17-record-person-context-card-actions.png) | Complete View, Edit, and separated destructive Remove hierarchy. |
| [18 — Edit opened from Record](18-person-edit-from-record.png) | Shared editor reached through Index while retaining a return path to the originating task. |
| Private reference — Linked People role grouping | Authoritative multi-person composition: About/Together portrait grid, Brief identity rows, Included people under `Also in entry`, and total count in the section heading. |

## Coverage boundary

This is a deliberately complete visual baseline for the approved People scope,
not a promise that every iOS state maps one-to-one onto a web surface. Loading,
empty, error, conflict, archive/restore, merge, safe-delete confirmation,
memories, pagination, hover, focus-visible, desktop layout, and responsive
breakpoints still require web-specific designs consistent with the plan and
the existing web component language.
