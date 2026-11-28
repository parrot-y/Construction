# Phase 1 closeout — full Playwright suite on 37bf8ea

Command: `playwright test` (chromium + mobile-390, 1 worker, e2e cluster DB)
Result: **444 passed / 0 failed / 0 skipped / 0 flaky** — 42.2 min

## What this run covers (P1 evidence)

- `p1-break-it.spec.ts` (16 runs): API stopped during project create → plain
  message + data kept + retry works; injected 403/409/422/500 → plain
  messages; double-click project create / invite / quote save / variation
  submit → exactly one record each; offline → saved/queued notice never
  blank; Fast 3G section nav → skeleton or content, never blank.
- `a5-portal-errors.spec.ts` (20 runs): dead link, 429, network failure on
  all five portal types → plain-language states with Retry.
- `a3-boq-entry.spec.ts` (12 runs): typed BoQ entry, edit, delete via
  AppDialog confirm, Excel import modal.
- `l2-click-sweep.spec.ts`: every sidebar tab admin + PM/QS + portal
  landings — every clickable control produces a visible effect, 0 offenders.
- `admin-console-capture.spec.ts`: 36 tabs × 2 viewports →
  `docs/evidence/visual/37bf8ea/admin-console/` + contact sheets.
- All locked `aud-*.spec.ts` unchanged (hash file untouched).

## Defects found and fixed during Phase 1 verification

| defect | fix | commit |
|---|---|---|
| OfflineSyncBanner masked queued work while offline | banner only claims "can't reach server" when online | 0d2d279 |
| l-procurement spec grabbed previous run's PO card | unique line description per run | 0d2d279 |
| g-journey checklist count raced hydration | expect.poll for real count | 8acd3db |
| ProjectChecklist stale-load race (wrong project's steps could render) | generation guard + 30s probe headroom | 90262da |
| a6-home expected "1 of 5" but typed project also completes BoQ step | accept 1-or-2 done | 37bf8ea |

## Speed (P1.7) — see admin-speed-37bf8ea.md

submit → project visible: **30,581 ms → 447 ms** on throttled 3G.
first useful screen: 3094 ms → 2402 ms (now PASS).
