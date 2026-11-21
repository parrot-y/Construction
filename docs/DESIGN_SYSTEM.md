# Product Design System

Single source of truth for visual language. Implemented as Tailwind v4 `@theme` tokens in `apps/web/src/index.css` and the component kit in `apps/web/src/ui/`.

## 1. Colour

- **Brand**: safety orange (`brand-600 #EA580C`) — primary actions, active nav, focus rings. Nothing else is "brand".
- **Neutrals**: slate scale for surfaces/text (`slate-50` page bg, `slate-900` headings, `slate-500` secondary text).
- **Semantic status only** — never decorative:
  - `success` emerald-600 — paid, approved, verified, complete
  - `warning` amber-500 — pending, review, at-risk
  - `danger` rose-600 — rejected, overdue, failed, destructive
  - `info` sky-600 — informational, in-progress
- Dark mode: same semantic hues on slate-900 surfaces; status must never rely on colour alone (always pair with icon or text).

Contrast: all text/background pairs meet WCAG AA (4.5:1 body, 3:1 large/UI).

## 2. Typography

- One family: **Inter** (`--font-sans`).
- Monospace (`font-mono`) ONLY for codes, IDs, serials and tabular numbers where alignment helps — never for labels or prose.
- No `uppercase` + `tracking-*` micro-labels. Labels are sentence case, `text-xs font-semibold text-slate-500`.
- Type scale: `text-xs` (11-12px meta), `text-sm` (body default), `text-base` (section body), `text-lg`/`text-xl` (card titles), `text-2xl`+ (page titles via PageHeader).

## 3. Spacing, radius, elevation

- Radius: `rounded-lg` inputs/buttons (8px), `rounded-xl` cards (12px), `rounded-2xl` modals/panels (16px). No other radii in new code.
- Elevation: one style — `shadow-sm` resting cards, `shadow-xl` overlays/modals. No gradient shadows, no coloured glows.
- Spacing: Tailwind 4px scale; card padding `p-5`, section gaps `gap-4`/`gap-6`.

## 4. Components (`apps/web/src/ui/`)

`Button` (primary/secondary/ghost/danger, sizes sm/md), `Input`, `Select`, `Textarea`, `Table`, `Badge` (semantic tones), `Card`, `Tabs`, `Modal`, `Toast` (context provider), `EmptyState`, `ErrorState` (retry), `Skeleton`, `PageHeader` (title + subtitle + primary action slot).

New screens MUST use these. Legacy views may keep Tailwind utilities until migrated; new code does not introduce new accent colours, emoji icons, or uppercase micro-labels.

## 5. Data display rules

- Money: `formatKes(amount)` everywhere — "KES 2,250,000". Never raw decimals, never floats (Decimal strings from API).
- Missing data → `EmptyState` with next action. Never invent stats, testimonials, or "insights" without supporting data.
- Simulated integrations show a visible SIMULATED badge.

## 6. Mobile & a11y

- Mobile-first: supervisor workflows usable one-handed at 360–390px; touch targets ≥44px; tables collapse to cards.
- Offline/sync state visible in header for field roles.
- All inputs labelled; visible focus (`:focus-visible` ring); modals trap focus + Escape closes; status never colour-only.
