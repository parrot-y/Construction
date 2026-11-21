# E2E evidence — commit ce4a440f38a410335a25b5eefddc66baceab56ad (Round H closeout)

Command:

```
cd e2e && pnpm playwright test
```

Environment: ephemeral PostgreSQL 18 cluster on :55444, `construction_e2e`
database with 24 migrations applied and `rls.sql` re-enforced; API on :4199
as non-superuser `db_app`, web on :5180 (vite dev proxy). Playwright
projects: `chromium` (Desktop Chrome) and `mobile-390` (Pixel 7, 390×844).

The suite executed on the working tree of commit `ce4a440` — the only
subsequent changes are evidence files (this document, verify logs,
screenshots).

Auditor spec hashes verified unchanged
(`sha256sum -c e2e/tests/aud-specs.sha256` → all 6 OK).

## Result

| project      | passed | failed | skipped | flaky |
|--------------|--------|--------|---------|-------|
| chromium     | 155    | 2      | 0       | 0     |
| mobile-390   | 154    | 1      | 0       | 0     |
| **total**    | **309**| **3**  | **0**   | **0** |

Duration: 34.1 minutes, 1 worker.

### The 3 failures were resource-contention flakes, proven by isolation rerun

The full matrix ran concurrently with `scripts/verify-local.sh` on the same
host (vitest API suite + Playwright browsers + two Postgres clusters). All
three failures are timing-sensitive and passed when re-run alone:

| spec | viewport | failure under load | isolated rerun |
|------|----------|--------------------|----------------|
| a-quote-to-cash › full chain | chromium | 120s test timeout | PASS (6.4s) |
| g-contractor-journey › step 8 checklist | chromium | "0 of 7 done" (fetches starved) | PASS (16.5s) |
| g-contractor-journey › step 8 checklist | mobile-390 | same | PASS (13.5s) |

Isolated rerun command:

```
pnpm playwright test tests/g-contractor-journey.spec.ts tests/a-quote-to-cash.spec.ts
→ 16/16 passed (3.0m)
```

Lesson recorded: verify-local and the Playwright matrix must run
sequentially on this host — concurrent runs starve the single-worker
suite past its timeouts.

## Screenshot evidence (this commit)

- `docs/evidence/visual/ce4a440/portal-flows/` — S6 closeout journeys
  (01–07) + H5 journeys (h5-01…h5-15), chromium + mobile-390.
- `docs/evidence/visual/ce4a440/h2-retention-console/` — H2 QS review at
  390px (01–02).

Note: an earlier H5-only run captured the same 15 H5 screenshots under
`docs/evidence/visual/473341a/portal-flows/`; the `ce4a440` set is the
final-commit canonical copy.
