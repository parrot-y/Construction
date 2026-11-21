# SiteSafi design system — Phase 3 spec

One page, one system. This document is the contract every screen follows;
`check-design` CI rules enforce the mechanical parts (raw colours, font sizes
outside the scale, emoji icons, gradients/glass/neon, stacked tab rows).

## 1. Principles

- Plain words a Nairobi contractor uses. No jargon headings, no ALL_CAPS enums.
- One accent: safety orange (`brand`) for the primary action and the active
  item only. Everything else is neutral slate.
- Status colours (green/amber/red) always pair with a word — never colour alone.
- Light theme only for the pilot. No dark theme, no gradients, no glass, no neon.
- Real data only. A block with no data says so in one sentence — never fake.
- Every number that summarises a list links to that list.

## 2. Tokens

### Colour

| token | value | use |
|---|---|---|
| `bg` | `#f8fafc` (slate-50) | page ground |
| `surface` | `#ffffff` | cards, panels |
| `ink` | `#0f172a` (slate-900) | headings, primary text |
| `body` | `#334155` (slate-700) | body text |
| `muted` | `#64748b` (slate-500) | secondary text, hints |
| `line` | `#e2e8f0` (slate-200) | borders, dividers |
| `accent` | `#ea580c` (orange-600) | primary action, active item |
| `accent-ink` | `#ffffff` | text on accent |
| `ok` | `#059669` + word | success status |
| `warn` | `#d97706` + word | warning status |
| `bad` | `#e11d48` + word | danger status |

Status colours are semantic only — never decorative.

### Type

System UI stack only: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
No webfont downloads. Sizes: **12 / 14 / 16 / 22** px. Weights: **400 / 600**.
Line length under 80 characters. Numbers that align use tabular figures.

| role | size | weight |
|---|---|---|
| page title | 22 | 600 |
| section heading | 16 | 600 |
| body | 14 | 400 |
| label / meta | 12 | 400–600 |

### Shape & space

8 px grid. Radius **8 px** everywhere (cards, inputs, buttons). Borders 1 px
`line`; cards may add the quietest shadow only when lifted on hover.
Tap targets ≥ 44 px on phone, ≥ 40 px on desktop. Inputs are 16 px on phone
(no iOS zoom).

### Icons

One outline set — Lucide, 20 px, always labelled in navigation. No emoji as icons.

## 3. Components

`Button` (primary=accent, secondary=outlined, ghost; one primary per view),
`Input`/`Select`/`Textarea` (label above, inline error below, 16px on phone),
`Card` (surface + 1px line + 8px radius), `Table` (desktop) → `StackedCards`
(under 640 px, one shared component), `StatusBadge` (word + colour),
`EmptyState` (one sentence + one verb button), `Skeleton` (rows, never a blank),
`Dialog` (AppDialog — replaces every native popup), `Toast` (transient, top),
`PageHeader` (title 22/600 + one primary action right), `Tabs` (one scrolling
row with edge fade on phone — never stacked rows).

## 4. Navigation

**Desktop — left sidebar, 240 px, labelled icons (Lucide 20px):**
order Home, Projects, Site, Money, People, Files and reports; Settings and Help
pinned at the bottom. The active section expands to show its tabs — ONE tab
level only. Sidebar collapses to icons and the choice is remembered.

**Top bar:** always-visible project selector showing project name + status;
global search; one "+ New" menu (project, quote, invoice, snag); user menu.
Theme toggle removed (light only).

**Phone — bottom bar, 56 px, safe-area aware:** Home, Projects, Site, Money,
More. Labels under icons. Tabs render as one horizontally scrolling row with an
edge fade. Exactly one primary action per screen.

## 5. Home dashboard (admin/exec) — block order

1. **Needs you now** — approvals waiting, overdue items, client requests,
   missing site log. Each row links to the exact screen.
2. **Progress against plan** — S-curve planned vs actual with today marker;
   chart title states the finding; labelled axes; table alternative; lazy-loaded.
3. **Money per project** — horizontal bars: contract, certified, invoiced,
   paid, retention held; numbers beside bars; no pie/donut.
4. **Next 8 weeks cash** — in/out timeline per project.
5. **Site health** — open snags by age and severity, incidents, missed diary days.
6. **Latest 6 verified photos** — thumbnail grid, each opens full evidence.
7. **Next 5 milestones** — soonest-due schedule tasks across projects.

"Client view" toggle reuses progress, money, photos and milestones with
client-safe wording (no internal notes, margins or snag detail).

New company: the 3–5 step "Get started" checklist stays on top until done.

## 6. Projects list

Card per project: code, name, type badge, location, status word + colour,
contract sum (KES formatted), open CO count/value, "Open workspace →".
Filters: status pills + project-type select. Selected project gets the accent
ring. Empty state: "No projects in this view" + create action.

## 7. New project

Four short steps, progress saved between steps:
1. **Type** — category cards (Residential, Commercial, Industrial,
   Institutional and public, Civil and infrastructure, Specialist,
   Renovation and fit-out, Other) → subtype chips.
2. **Basics** — name, code, location, client, contract sum, dates.
3. **Commercial** — retention rate/cap, first moiety, deposit.
4. **Team** — optional invite skippable step.
NCA class hint appears from the editable rules table when the type implies it.
Submit disables in flight; success shows the card immediately and refreshes
in the background.

## 8. States (every screen)

Loading → skeleton rows. Empty → one sentence + one action. Error → plain
words + Try again, typed data kept. Offline/queued → status dot + banner only
when relevant. Slow → skeleton within 100 ms, data within 1.5 s on Fast 3G.

## 9. Banned

Gradients, glassmorphism, neon, emoji icons, stacked tab rows, raw
`err.message`, `TypeError: Failed to fetch`, native `alert/confirm/prompt`,
ALL_CAPS status enums in UI, pie/donut charts, dead buttons, horizontal page
scroll on phone.
