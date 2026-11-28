# Phase 3.7 — banned-pattern review

Scope: the three gate screens (Home, Projects list, New project wizard) plus
the app shell (sidebar, top bar, bottom bar). Automated counts are from
ripgrep over `apps/web/src` on the reviewed commit; screenshots live under
`docs/evidence/visual/<sha>/design-gate/`.

| banned pattern | check | result |
|---|---|---|
| Gradients / glassmorphism / neon | `gradient` in `components/console/**` | 1 hit — `maskImage` edge fade on the mobile tab strip (functional fade, not a fill). 0 in gate screens. `backdrop-blur` in console: 0 (modals elsewhere use it only as overlay dim). |
| Emoji icons | unicode scan of `*.tsx` | 4 hits, all typographic `✓`/`✕` glyphs (checklist, access list, procurement) — not emoji icons; icon set is outline SVG (`icons.tsx`). |
| ALL-CAPS enum text in UI | `uppercase` in `components/console` | 1 hit — "Display currency" settings label (a word, not an enum). Status text goes through `statusLabel()`; raw statuses never render. |
| Raw `err.message` / `TypeError: Failed to fetch` | hygiene guard + grep | 0 (CI-enforced). |
| Native `alert`/`confirm`/`prompt` | hygiene guard | 0 — shared `AppDialog`/`dialog.confirm` used. |
| Dead buttons | hygiene guard (`<button>` without handler/submit/disabled) | 0. |
| Stacked tab rows | nav structure | One tab level: section → nested tabs in sidebar; phone uses one scrolling strip + More sheet. |
| Pie / donut charts | code scan | 0 charting libs; Home uses bars (money), lines (S-curve), timeline (cash). |
| Jargon headings | copy review of gate screens | Headings are plain: "Needs you now", "Progress against plan", "Money per project", "Next 8 weeks cash", "Site health", "Latest photos", "Next milestones". |
| Permanent banners | shell review | Only `OfflineSyncBanner` renders when offline/queued; status dot otherwise. |
| Horizontal page scroll on phone | viewport checks in gate spec | Page `scrollWidth <= viewport` asserted implicitly by layout; tables use `rt` stacked cards under 640 px. |
| Fake data | data-source review | All dashboard blocks read real endpoints (`/dashboard`, `/cash-flow`, site diaries, snags, milestones, photos); empty states say so in one sentence. |

## Deliberate exceptions

- **BoQ workbook table** keeps contained horizontal scroll inside its card
  (`overflow-x-auto`) — it is a workbook with section header rows and
  colspan edit rows that cannot flatten into label/value cards without
  losing meaning. The page itself never scrolls horizontally.
- **Roles permission matrix** scrolls inside its card for the same reason.
- **`moneyTable`** in dashboard chart blocks is a two-column label/value
  table inside a `<details>` "Table view" disclosure — it is the accessible
  alternative to the chart, not a record list.

## Phase 3.8 — sunlight check

- **Contrast**: all `text-slate-400` in the console and New project modal
  raised to `text-slate-500` (≈4.7:1 on white) — 101 occurrences fixed.
  Status colours remain paired with words.
- **Inputs**: console form fields, search and the Ask AI field now use
  `text-base sm:text-sm` (16 px on phones — no iOS focus zoom).
- **Tap targets**: phone bottom bar is 56 px + safe-area; nav items and
  primary actions meet the 44 px floor. Dense table action links (Edit /
  Delete / Revoke) remain below 48 px — recorded as residual debt for the
  rollout pass, not hidden.
