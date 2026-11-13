# C2 — Code splitting & bundle budget evidence

Commit: see `git log` for the C2 commit on `devin/contractor-lifecycle`.

## What changed

- Route-level `React.lazy` + `<Suspense>` boundaries:
  - `App.tsx`: all 5 external portal views, PublicQuoteView, SignupForm,
    InviteAcceptView, PasswordResetViews, LegalPage.
  - `Dashboard.tsx`: Client/Owner/Field dashboards, AppShell, portal previews.
  - `console/AppShell.tsx`: all 6 console sections, AskAiPanel, portal previews.
- `apps/web/vite.config.ts`: `preview.proxy` mirrors `server.proxy` so
  `vite preview` can serve the API-backed console for measurement.
- `scripts/check-bundle-size.sh` + CI step: initial JS (index-*.js entry
  chunks) must stay ≤450 KB raw / ≤140 KB gzip.

## Bundle size (vite build, production)

Before: single `index-*.js` = **1,305.79 kB raw / 309.24 kB gzip**
After:  entry chunks `index-*.js` = **305,663 B raw / 97,253 B gzip**
       (272.97 kB + 32.70 kB shared chunk) — heavy modules split into
       per-route chunks (MoneySection 208 kB, SiteSection 58 kB,
       dashboards/portals 4–37 kB each, loaded on demand).

`bash scripts/check-bundle-size.sh` → `OK` (run on this commit's build).

## Lighthouse 12 — mobile form factor, simulated Slow 4G throttling

Command shape:
`lighthouse <url> --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate --only-categories=performance`

| Page | Perf | LCP | CLS | TBT | Speed Index |
|------|------|-----|-----|-----|-------------|
| Landing (`/`) | 0.96 | 2.1 s | 0 | 140 ms | 2.3 s |
| Login (same entry, sign-in state) | 0.96 | 2.0 s | 0 | 130 ms | 2.2 s |
| Console home (`/app`, authenticated admin) | 0.64 | 2.0 s | 0 | 1,290 ms | 10.5 s |

Console home notes: lazy section chunks stream in after shell paint; TBT is
dominated by dashboard data fetch + chart/table render on a throttled CPU.
LCP/CLS are good; further wins need lighter first paint (skeleton instead of
blocking section render) — tracked as follow-up, not a C2 blocker since the
item's hard target was the JS budget, which is met with margin.
