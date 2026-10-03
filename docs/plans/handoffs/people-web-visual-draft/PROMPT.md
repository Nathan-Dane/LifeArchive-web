# LifeArchive web People visual-draft brief

You are the senior product designer and frontend prototyper for this task. Work
independently and critically: first understand the supplied product evidence,
then plan three realistic near-neighbour directions, then implement the
approved directions as standalone HTML documents.

This is a visual and interaction prototyping task, not production React work.
Do not edit or invent production APIs, persistence, database behaviour, or
business rules. The HTML may simulate state in memory and must label synthetic
content and simulated persistence honestly.

## Inputs

The attached handoff contains:

- `web-shell-template.html`: a deliberately plain, interactive reduction of
  the real LifeArchive web shell and Record workspace. Treat its shell,
  responsive column behaviour, semantic tokens, typography, and overlay
  mechanics as the design context. Extend and refine it; do not replace it
  with an unrelated app shell.
- `people-feature-parity-plan.md`: the feature and cross-platform behaviour
  plan. This is the source of truth for scope and parity.
- `screenshots/README.md`: screenshot inventory and web translation notes.
- `screenshots/01-...png` through `21-...png`: dark-mode iOS evidence using
  synthetic test data. The separate user-supplied layout reference is kept
  outside public Git because it contains personal names and portraits; use
  only the composition description in the inventory. Use the set for feature coverage, information
  hierarchy, terminology, and familiar interaction states, not for
  pixel-copying iOS.
- `SOURCE_NOTES.md`: condensed facts about the current web implementation and
  the boundaries of the prototype.

Read every supplied document and inspect every screenshot before proposing a
direction. If an input is unavailable, say exactly which one rather than
silently designing around it.

## Product and visual constraints

- Dark mode only. The production web app already has light/dark semantic
  tokens, so do not spend time designing a light variant.
- Use the supplied semantic web tokens. Do not sample colours from iOS images
  or create a parallel visual system.
- The web result should feel familiar to iOS in its concepts, hierarchy,
  labels, control order, and task outcomes, while following desktop web norms.
- Make responsible use of larger screens: intentional reading widths,
  informative split layouts where appropriate, desktop popovers/dialogs, and
  responsive drawers/dialogs. Do not simply inflate an iPhone screen.
- The three directions must be credible siblings—roughly 70–85% shared—not
  artificial extremes. Discover three subtle, consequential axes after
  analysing the evidence (for example density, directory/detail relationship,
  and placement of contextual actions). Do not create a novelty concept merely
  to satisfy the number three.
- Preserve LifeArchive's quiet, warm, archival, restrained character. No
  dashboards, activity feeds, statistics, social-product patterns, glassmorphism,
  generic SaaS chrome, or speculative entity framework.
- Index contains exactly People, Tracks, and Media. People and Tracks are real
  destinations. Media is visibly deferred and must not navigate to the
  existing storage/size-reduction tool. Do not design Media content yet.
- Use synthetic, non-sensitive demo data only.

## Required feature coverage

Each direction must provide a coherent web equivalent for all missing People
features represented by the plan and screenshots, not merely a directory
landing page. At minimum, make these destinations and states inspectable:

1. Index root with People, Tracks, and a visibly deferred/non-navigating Media
   card.
2. People directory: initial loading, retryable error, empty, populated,
   search, no results, active/archived grouping, manage mode, and paging/load
   more. The first successful load must display immediately without a search
   or manage-mode nudge.
3. Quick Create Person: required name, optional connection, disabled/working/
   error states, followed by the shared full editor.
4. Person profile: identity hero; connections; About; names, pronunciation,
   pronouns, and partial life dates; references; bounded memories; recorded
   contact empty, summary, history, log-contact, success, and Undo states.
5. Person editor: portrait controls; all profile fields; partial date precision;
   standard/custom connection selection; references; dirty, saving, failure,
   and conflict handling; archive/restore, merge, and safe delete confirmations.
6. Record workspace in the real shell, including the web three-column wide
   layout and responsive navigation/details drawers.
7. A reusable Record edit-context-section presentation template. Demonstrate
   Add Context, available/visible/hidden sections, add/remove/clear, reorder,
   pin/unpin, and Undo flows. Treat pinning as an interaction proposal in the
   prototype—not as proof that durable pinning already exists. Keep the
   template general without inventing unapproved domain sections.
8. Record People manager: absent/empty, unassigned, assigned, search, quick
   creation, role assignment, removal, ordering, and stable mutation/error
   context.
9. Record linked-People section with the exact familiar hierarchy evidenced in
   screenshot 22: retain the total count in the `People` heading; give `About`
   and `Together` people the prominent portrait/name/role grid; place `Brief`
   people in a labelled compact identity-row group; and place role-free
   `Included` people in a separate `Also in entry` identity-row group. Adapt
   column count and row density responsively while keeping this hierarchy. Do
   not flatten every role into identical chips or a single generic list.
10. Clicking a linked Person opens one focused context task card, not a menu:
    a large portrait/initials identity hero with no birth/life-date line; the
    horizontal roles in the exact order `Included`, `Brief`, `Together`,
    `About`; then `View person`, `Edit person`, and a separated destructive
    `Remove from this entry`. The selection uses a check plus a surface change,
    not colour alone. Include pending, retryable failure, and removal/Undo.
11. Record → View/Edit Person handoff to canonical Index → People pages. Show a
    visible back/breadcrumb affordance and trustworthy browser-history
    semantics that restore the same selected Record, scroll location, editor
    buffer, and opener focus. Include the stale-origin fallback concept.
12. Keyboard, hover, focus-visible, screen-reader labelling, reduced motion,
    long-text, compact/mobile, tablet, and wide-desktop considerations.

Preserve this domain distinction: interaction roles are offered only where the
exact Day/Event rule supports them; participation and subject semantics remain
independent elsewhere. The prototype may explain unsupported controls but
must not manufacture unsupported behaviour.

## Prototype requirements

Create four deliverables:

- `people-direction-a.html`
- `people-direction-b.html`
- `people-direction-c.html`
- `record-context-sections-template.html`

Each file must be a self-contained, browser-runnable HTML document with inline
CSS and JavaScript and no build step, network dependency, external font, or
external image. If portraits are needed, use embedded data URLs, CSS, or
initials. The three direction files should each contain enough connected demo
state to evaluate the full flow, not disconnected screenshot artboards.

Add a restrained `Prototype controls` panel or route/state navigator so every
required state is reachable without polluting the proposed production UI.
Normal UI controls should work: navigation, search, selection, role changes,
context add/pin/remove/Undo, overlays, profile/editor transitions, compact
drawers, and Escape/backdrop dismissal. Preserve focus when opening/closing
overlays. Honor `prefers-reduced-motion`.

Use semantic HTML, real buttons and form controls, meaningful landmarks,
visible focus styles, adequate hit targets, and useful accessible names. Aim
for viewports around 1440px, 1024px, and 390px, and prevent horizontal page
overflow. The demo may provide a viewport-density switch, but it must also
respond correctly to the actual browser width.

Do not copy any markup or styling from `docs/reference/`; it is not supplied
for that reason. Do not output production claims such as “saved permanently.”

## Staged workflow

### Phase 1 — analysis and independent design plan

For your first response only:

1. Confirm the exact inputs you inspected, including all 22 screenshots.
2. Build a compact feature/state inventory and call out any contradictions or
   assumptions.
3. Define three complete, realistic directions independently. For each, cover:
   information architecture; wide/tablet/mobile composition; directory/profile/
   editor relationship; Record contextual-task treatment; route/back model;
   shared components and tokens; accessibility; strengths; risks; and what is
   intentionally unchanged.
4. Compare the directions in a decision table and recommend one, while keeping
   all three viable for implementation.
5. Provide a file-by-file implementation plan and an interaction/state test
   checklist for the HTML deliverables.

Do not write HTML in Phase 1. Stop and wait for review.

### Phase 2 — implementation after follow-up

After approval or corrections, implement all four HTML files. Run your own
coverage review against every numbered requirement above. Return downloadable
`.html` files plus one ZIP containing all four and a brief README. If direct
file attachments are unavailable, provide exactly one complete code block per
file, with no omissions or placeholders, and then package them as soon as the
environment permits.

### Phase 3 — self-critique and revision

After the files exist, report the interaction paths you exercised, gaps you
found, and any realistic improvements. Wait for focused feedback, revise the
files, and repackage the final ZIP. Do not widen scope into production code.
