# Admin-console speed — final Part-A commit `a486643`

Production build (`vite build` → nginx :5181 serving `apps/web/dist` with gzip),
Fast 3G profile (150 ms RTT, 1.6 Mbps down / 0.75 Mbps up), 4x CPU throttle,
390 px viewport. Five sequential runs on this host.

Host note: load average was ~20 during measurement — the host was NOT quiet.
Numbers below are therefore pessimistic; reported honestly per instructions.

## First useful screen (/app → Home) — 5 runs

| run | ms | budget | result |
|---|---|---|---|
| 1 | 7149 | < 3000 | MISS |
| 2 | 5230 | < 3000 | MISS |
| 3 | 4734 | < 3000 | MISS |
| 4 | 4702 | < 3000 | MISS |
| 5 | 4382 | < 3000 | MISS |
| **median** | **4734** | < 3000 | **MISS** |

Entry chunk reduced 327.8 kB → 270.3 kB (A7, `f8b9c3a`: LoginForm and
LandingPortalHub lazy-loaded out of the critical path). The remaining cost
is JS parse/execute of the ~270 kB entry plus AppShell/HomeSection chunks
under 4x CPU throttle on a loaded host. A reliable sub-3000 ms result needs
a smaller critical-path bundle — follow-up, not hidden.

## Other budgets (all 5 runs)

- Section shells: all <100 ms except one 126 ms outlier (Run 5, Site) and
  one 325 ms (Run 1, Home) under load — intermittent host-load artefacts.
- Section data: all <1500 ms (worst 719 ms).
- CLS first screen: PASS 4/5 (0.000–0.085); one 0.221 section-nav outlier
  in 3/5 runs — intermittent, load-correlated.
- POST → project card: 44–141 ms.
- JS transferred: ~175–180 KiB; total ~356–501 KiB (gzip active).

Budget tally per run: 17/19, 17/19, 17/19, 18/19, 16/19.
