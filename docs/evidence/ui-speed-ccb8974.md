# UI speed — Phase 4 measurements

Commit: ccb8974 (app code identical to f32f38e; this commit adds only the
nginx gzip block, which is what the measurement server mirrors)
Script: `scripts/measure-admin-speed.mjs`
Environment: production build served by nginx with the same directives as
`apps/web/nginx.conf.template` (gzip on, immutable hashed assets, no-cache
HTML/sw.js), API on Fastify, Fast 3G (150 ms RTT, 1.6 Mbps down / 750 Kbps
up), 4x CPU throttle, 390 px viewport, mid-range Android profile.
Host note: shared dev machine, load average 5–12 during measurement —
absolute numbers carry that noise; the budget misses below are reported
honestly rather than tuned away.

## Before → after (first useful screen, same throttle profile)

| checkpoint | first screen | notes |
|---|---|---|
| Phase 3 baseline (admin-speed-ec00767) | 3094 ms MISS | per-project fetch fan-outs, duplicate shell calls |
| P4.1–P4.3 (summary endpoint, dedupe, paged lists) | ~3415 ms | request count way down; still MISS |
| P4.5 (SW precache deferred, console chunks warmed during auth) | 2801–3930 ms | best observed PASS at quiet load |
| P4.7 (gzip in nginx template; measured via nginx) | 3436–4778 ms | bandwidth fixed; CPU-bound now |

## Final run on ccb8974

| metric | value | budget | result |
|---|---|---|---|
| first useful screen (/app → Home) | 3436 ms | < 3000 ms | MISS by ~15% |
| layout shift — first screen (CLS) | 0.085 | < 0.1 | PASS |
| nav → Projects shell / data | 32 ms / 345 ms | <100 / <1500 | PASS |
| nav → Money shell / data | 33 ms / 446 ms | <100 / <1500 | PASS |
| nav → People shell / data | 16 ms / 282 ms | <100 / <1500 | PASS |
| nav → Site shell / data | 14 ms / 377 ms | <100 / <1500 | PASS |
| nav → Files & reports shell / data | 14 ms / 265 ms | <100 / <1500 | PASS |
| nav → Home shell / data | 33 ms / 58 ms | <100 / <1500 | PASS |
| worst layout shift — section nav (CLS) | 0.056 | < 0.1 | PASS |
| submit → project visible (POST→card) | 61 ms | reported | PASS |
| JS transferred | 177 KiB (gzip) | — | — |
| total transferred | 494 KiB | — | — |

18/19 budgets met.

## Honest reading

- **First screen is CPU-bound, not bandwidth-bound.** After P4.7 the JS
  payload is ~177 KiB gzipped; gzip cut transfer ~70% but the time barely
  moved, so the remaining cost is parse+execute of ~660 kB of JS under 4x
  CPU throttle plus the `/auth/me` + lazy-chunk waterfall. Getting under
  3 s needs a smaller critical-path bundle (route-level code splitting of
  the console shell itself, or dropping eager deps) — flagged as follow-up,
  not silently tuned.
- Observed range across identical-code runs: 2801–4778 ms depending on
  host load; one quiet-host run passed at 2801 ms.
- An attempted entry-chunk split (lazy LoginForm/LandingPortalHub, P4.6)
  was reverted: it introduced a real lazy-boundary race in specs that probe
  the landing page synchronously, and the ~57 kB saving did not move the
  number reliably under host noise. Reverted rather than shipped unverified.
- Everything a user *does* after first paint is fast: every section shell
  <100 ms, every section's data <500 ms (budget 1500 ms), project create
  POST→card ~40–170 ms, CLS <0.1 everywhere.
