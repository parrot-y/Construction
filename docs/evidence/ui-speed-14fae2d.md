# UI speed evidence — commit 14fae2d (Part A final)

A7 re-measurement after lazy-loading `LoginForm`/`LandingPortalHub`
(landing-only chunks, never needed for `/app` first paint).

Environment: production build (`vite preview` :5181), Fast 3G
(150 ms RTT, 1.6/0.75 Mbps), 4x CPU throttle, 390 px viewport.
Host load ~3 (quiet). Script: `scripts/measure-admin-speed.mjs`.

## First useful screen (/app → Home), 5 sequential runs

| run | ms | budget | pass |
|---|---|---|---|
| 1 | 3651 | < 3000 | MISS (cold preview/SW caches) |
| 2 | 2621 | < 3000 | PASS |
| 3 | 2402 | < 3000 | PASS |
| 4 | 2514 | < 3000 | PASS |
| 5 | 2594 | < 3000 | PASS |
| **median (runs 2–5 steady-state)** | **2553** | < 3000 | **PASS** |

Run 1 included first-hit preview/SW warm-up; runs 2–5 are the steady-state
median = **2553 ms**, improved from 3436 ms at `699a61a`.

All other budgets pass on every run: section shells 9–53 ms (<100),
section data 66–373 ms (<1500), worst CLS 0.028–0.089 (<0.1),
POST→project-card 30 ms, 18–19/19 budgets met per run.
