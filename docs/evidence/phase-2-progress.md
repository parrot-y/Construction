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
  `ui/` primitives is incremental.
- Console interior pages at 390px verified only for landing + portal flows in
  e2e; a full console sweep at 360px is not done.
- Accessibility pass (labels/focus/keyboard) is partial — ui/ components have
  focus styles; every legacy modal hasn't been audited.
