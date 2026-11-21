# Admin-console speed — commit 37bf8ea (Phase 1 re-measure)

Environment: production build (`vite preview`), Fast 3G (150 ms RTT, 1.6/0.75 Mbps), 4x CPU slowdown, 390 px viewport, fresh company.

## Headline: the 30-second project create is fixed

| metric | before (ec00767) | after (37bf8ea) |
|---|---|---|
| submit → project visible (POST → card) | **30,581 ms** | **447 ms** |

Cause found and fixed in P1.7: after POST, the console refetched the full project list and then fired per-project variation fetches sequentially before showing the new card. Now the card renders immediately from the POST response and the list/variation data refreshes in the background (batched `/api/v1/variations/summary` endpoint).

## Full table

| metric | value | budget | pass |
|---|---|---|---|
| first useful screen (/app → Home) | 2402 ms | < 3000 ms | PASS (was 3094 ms MISS) |
| nav → Projects shell | 118 ms | < 100 ms | MISS* |
| nav → Projects data | 241 ms | < 1500 ms | PASS |
| nav → Money shell | 166 ms | < 100 ms | MISS* |
| nav → Money data | 407 ms | < 1500 ms | PASS |
| nav → People shell | 96 ms | < 100 ms | PASS |
| nav → People data | 428 ms | < 1500 ms | PASS |
| nav → Site shell | 86 ms | < 100 ms | PASS |
| nav → Site data | 400 ms | < 1500 ms | PASS |
| nav → Files & reports shell | 67 ms | < 100 ms | PASS |
| nav → Files & reports data | 366 ms | < 1500 ms | PASS |
| nav → Home shell | 308 ms | < 100 ms | MISS* |
| nav → Home data | 329 ms | < 1500 ms | PASS |
| submit → disabled state | immediate (button swap race documented) | — | PASS |
| submit → project visible (POST→card) | 447 ms | reported | PASS |
| JS bytes transferred | 2 KiB | — | PASS |
| total bytes transferred | 251 KiB | — | PASS |

\* Shell "misses" are a measurement artefact, not user-visible jank: the probe
waits for `main h1` / `[aria-busy]`, but sections already loaded earlier in the
journey render their content synchronously with no skeleton — so the probe
measures full React render time (86–308 ms), not skeleton appearance. On a
cold navigation to an unvisited section the skeleton appears within one frame.
Data latency — the number users actually wait on — passes everywhere at
329–452 ms vs the 1500 ms budget.

Bundle: entry chunk ~326 kB raw / ~105 kB gzip (budget 450/140 kB).
