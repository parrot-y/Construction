# Phase 2 progress — design system (partial, honest)

## Done this session
- `docs/DESIGN_SYSTEM.md` + Tailwind tokens + `apps/web/src/ui/` kit exist.
- `formatKes` migration: ~30 components render money through `formatKes`
  (commit a16d6a7); `currency-guard.test.ts` baseline shrunk by 9 files and
  fails on NEW violations — 118/118 web tests green.
- Uppercase micro-labels + wide tracking stripped across 75 components
  (commit eb21b1e); typecheck + 118/118 green.
- Landing page verified clean: no emoji, no gradient hero, no invented stats
  (rewritten earlier; grep confirms).
- Mobile check: landing scrollWidth == clientWidth at 390px (no overflow).

## Still open (not claimed)
- `font-mono` sweep: ~480 usages remain; mono is legitimate for codes/numbers
  but many are decorative — needs case-by-case review, not a blanket codemod.
- Legacy views still carry ad-hoc card/spacing patterns; full migration to
  `ui/` primitives is incremental. Sections migrated so far: PeopleSection
  (9 cards; also removed a duplicated subcontractors/suppliers directory
  card that rendered twice), FilesSection (6), ProjectsSection (2),
  MoneySection (3), SiteSection (4), BoqWorkbookView (4), HomeSection (1),
  plus the remaining ad-hoc card surfaces: ProjectMapView (4),
  PurchaseRegisterView (3), ProjectChecklist (2), ClientRequestView (2),
  RateMasterView/GatePassView/ContractorMasterView tables (1 each),
  ClientAccountView (1). The `bg-white … rounded-2xl` card pattern is now
  fully migrated to `ui/Card`. Also fixed a real 360px overflow the sweep
  caught: Money-per-project rows let a `truncate` (nowrap) project name
  inflate the grid item's min-content — long project names now clamp with
  `line-clamp-1 break-words` instead.
- Console 360px sweep DONE: `e2e/tests/console-360-overflow.spec.ts` walks
  every console section tab at a forced 360px viewport asserting
  `scrollWidth <= innerWidth` (chromium + mobile-390 green). It caught and
  fixed two real overflows: GatePassView status-filter chips and the
  CertificatesCloseoutView stage stepper — both now scroll horizontally
  inside their containers instead of pushing the page wide.
- Accessibility pass DONE (first gate): `e2e/tests/a11y-audit.spec.ts` runs
  axe-core (wcag2a/2aa/21a/21aa) over landing, login and 7 console tabs on
  chromium + mobile-390 — zero critical/serious violations. Fixes shipped:
  sidebar `role="tab"` now inside `role="tablist"`, status dot `role="img"`,
  loading skeleton `role="status"`, unlabeled member-role selects got
  `aria-label`, icon/avatar buttons' accessible names now contain their
  visible text, and a codebase-wide contrast pass (chromatic `text/bg`
  300–600 → 700, `text-slate-400` → `text-slate-600`, light-mode only —
  `dark:` variants untouched). Remaining: moderate/minor axe findings are
  reported but don't gate; per-page keyboard/focus walkthrough still open.

## Session 2 additions (commit cd49cfd)
- Fabricated defaults removed from VarianceMonitorCard, BudgetSummaryCard,
  PracticalCompletionCard; cards fetch real data via projectId
  (/dashboard, /budget/summary, /closeout) or render honest EmptyState.
- font-mono audit: 13 decorative misuses removed; ~470 legitimate
  code/number usages kept.
- Emoji sweep: ⭐/⬇ removed; zero emoji remain in apps/web/src.
- Test suite: fixtures pass explicit props; unhydrated views assert
  honest empty states — 118/118 green.
