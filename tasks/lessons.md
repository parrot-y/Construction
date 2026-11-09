# tasks/lessons.md — corrections & preventions

## 2026-11-07 — browser-automation session lessons

1. **pgrep self-match**: `pgrep -f cleanup-survey` matched the checking `bash -c` wrapper, not the node process. Use `pgrep -x node` + `ps -o args=` inspection, or check output files.
2. **Lost stdout**: backgrounded `exec` shells can lose their ID; scripts MUST write progress to a log file (`fs.writeFileSync` per step) so state survives.
3. **Field targeting by value is dangerous**: setting "the field containing ZZ-RESEARCH" hit the crew-name input instead of work-done — corrupted data then saved. Always target by **label/placeholder**, dump all fields first, and verify which field was hit before saving.
4. **Sidebar nav is fragile**: child rows only exist after group expansion; clicks need waits + dismiss of onboarding modals. Verify navigation by checking page body text, not just click return.
5. **Don't claim "no delete" from list view alone**: invoice/quote rows showed only PDF/action buttons, but detail panels may differ — probe detail before concluding.
6. **Headless scripts die silently**: wrap in try/catch writing errors to the log file; always `await b.close()` in finally.
7. **Coverage honesty**: report OBSERVED/INFERRED/NOT REACHED explicitly; a checked todo is not evidence.

## 2026-11-07 — S1 quotes implementation lessons

8. **Public token routes under RLS**: raw `prisma.*` queries bypass nothing — RLS hides rows without `app.current_tenant_id`. Public share links must resolve tenant via a narrow SECURITY DEFINER lookup fn (see `lookup_portal_link_by_hash` / `lookup_quote_by_share_hash` in rls.sql), then do all reads/writes inside `withTenantTx`.
9. **Store token hashes, not tokens**: `share_token_hash` = SHA-256 hex; raw token returned once at send; rotate on re-send. Never put the hash in API responses (`formatQuote` strips it).
10. **`throw { status }` needs a local try/catch**: the global error handler only maps `error.statusCode`, not `.status` — unhandled `{status:409}` throws surface as 500. Every tx block that throws status objects must be wrapped.
11. **Return the post-update row**: `tx.quote.update(...)` result must be returned, not the pre-update `findFirst` object, or the API reports stale status.

## 2026-11-07 — Claude re-audit remediation lessons

12. **History purge requires filter-repo, not rm**: deleting files in a new commit leaves them in history. `git filter-repo --path <dir> --invert-paths --force` rewrites all refs; re-add `origin` remote afterwards (filter-repo removes it) and force-push.
13. **Throwing inside withTenantTx rolls back sibling writes**: to "expire then reject", return a sentinel (`{expired:true}`) from the tx callback and map it to the HTTP error AFTER commit — a `throw {status}` inside the tx undoes the status flip you wanted to persist.
14. **Atomic state transitions**: `findFirst` + `update` has a TOCTOU race on public endpoints. Use `updateMany({where:{id, status:'SENT'}})` and check `.count` — exactly one concurrent responder wins.
15. **ADR-005 money rule applies to NEW code too**: never `Math.round(x*100)/100` or `+`/`*` on money — use `calculateLineTotal`/`toDecimal` from `@construction/money`, ROUND_HALF_UP to cents at line level, subtotal = exact sum of line totals.
16. **Route auth needs a CI guard, not vigilance**: static-scan `server.METHOD('path', {preHandler…})` registrations; anything without `authenticate` must be in an explicit allowlist (C-01 test enforces both directions).
17. **git push 403 on large packs**: set `git config http.postBuffer 524288000` before pushing rewritten history.

## 2026-11-07 — S3 change orders + environment lessons

18. **pnpm 12 shebang-less bootstrap breaks turbo**: `~/.local/bin/pnpm` → `lib/node_modules/pnpm/pnpm` is intentionally shebang-less (kernel ENOEXEC). Shells fall back to `sh`, but turbo/Rust `Command::spawn` does NOT — every `turbo run` task failed with "Exec format error (os error 8)". Fix: repoint the symlink to the real native binary `lib/node_modules/pnpm/node_modules/@pnpm/exe.linux-x64/pnpm` (same version, directly exec'able). If turbo spawn fails, check `which -a pnpm` first.
19. **API tests need the ephemeral DB env**: vitest suites skip/fail without `DATABASE_URL`+`PG_*`. For fast iteration, replicate verify-local steps 1–6 manually on a scratch cluster, run `pnpm vitest run <file>` inside `apps/api`, then do the full `verify-local.sh` only on the final head.
20. **Prisma Decimal `.toString()` drops trailing zeros**: `Decimal('10000.00').toString()` → `'10000'`. API money fields must use `.toFixed(2)` when a stable 2dp string contract is expected (approval limits, budgets).
21. **Include-then-write staleness**: `tx.model.create({include})` returns rows fetched BEFORE subsequent writes in the same tx — re-`findUniqueOrThrow` after `recordCoEvent`/audit writes if the response must contain them.
22. **Legacy status normalization**: keep `normalizeCoStatus` at read boundaries; guarded `updateMany({where:{status: <raw stored>}})` claims transitions AND migrates legacy rows in one write.
- 2026-11-08: verify-local lint (tsc) catches unused vars that vitest tolerates — ALWAYS run 'pnpm --filter @construction/api exec tsc --noEmit' (and web) before committing test files; vitest passing is not sufficient.
23. **Never edit the repo while verify-local.sh runs**: turbo lint/typecheck/build/test read the working tree — in-flight edits cause spurious failures (hit twice: checklists.ts TS error mid-run; stale test DB after schema push). Freeze edits during the ~25min window; batch commits BEFORE launching verify.
24. **verify-local's db push is a point-in-time snapshot**: schema changes made after Step 3 leave the test DB stale → mass failures in unrelated suites (inspection enum). Re-run verify after ANY schema change before claiming green.
25. **Test helpers return parsed bodies, not strings**: `login()` helpers that return `{cookie, body: JSON.parse(res.body)}` — don't JSON.parse(body) again (SyntaxError "[object Object]").
26. **SiteLaborer requires phone_number + unique national_id**: direct prisma seeding in tests needs both; use timestamped IDs to survive re-runs.

27. **Live-capture before rebuilding UI**: never infer a competitor's IA from notes — log in with supplied creds, screenshot+DOM-dump every role/section, encode the matrix in config, THEN build. (User correction 2026-11-08: "I gave you logins, open it portal by portal.")
28. **Probe scripts are repo litter**: playwright capture scripts with credentials must live in /tmp, never the repo — `git add -A` swept 10 of them into history once. Keep research tooling outside the worktree.
29. **Double chrome**: when introducing a new app shell, early-return it BEFORE legacy header/layout wrappers — nested sticky headers/permission bars render twice.
30. **Component tests ≠ routing tests**: Dashboard-level "embeds X" tests should render the view component directly once routing moves to a config-driven shell; update deliberately, don't delete coverage.

## 2026-11-09 — dev demo DB drift
The live dev API uses `construction_demo`, tests/verify use `construction_test` on the same PG cluster. Schema changes (db push / migrations) must be applied to BOTH or the running app 500s while tests stay green. Check `/proc/<api-pid>/environ` DATABASE_URL to confirm which DB the dev server uses.

## 2026-11-09 — e2e workspace gotchas
- pnpm workspace globs match DIRECTORIES: `'e2e/*'` looks for subdirs of e2e/, not e2e itself — use `'e2e'`.
- API refuses to boot on superuser DB roles (RLS guard) — e2e must run API as non-superuser `db_app` and setup as `db_migrator`; `NODE_ENV=test` skips listen entirely.
- Health endpoint is `/health`, not `/api/v1/health`.
- `@react-pdf/hyphenate` needs `scripts/patch-hyphenate.cjs` on fresh installs — added as root postinstall.
- Playwright `request` fixture shares the cookie jar within a test — "unauthenticated" checks need `request.newContext()`.
- New workspace packages with a `test` script get picked up by `turbo run test` — name e2e scripts `test:e2e` or verify-local will try to run them without infra.
- API response envelopes vary: `{data}`, `{invoice}`, `{message,data}` — unwrap centrally in test helpers.
- Decimal fields (quantity, unitRate, amounts) are STRINGS in validation schemas — send '40' not 40.

- 2026-11-09: Never run whitespace-collapsing regexes (`re.sub(r'  +',' ',s)`) over whole source files — it destroys indentation. Collapse only intra-line runs (`(?<=\S) {2,}(?=\S)`).
- 2026-11-09: Tests that pass only because of fabricated component DEFAULT PROPS are testing fake data — when removing defaults, update tests to pass explicit fixtures or assert honest empty states.
- 2026-11-09: Concurrent subagents + `git stash` in the same worktree can clobber live edits — avoid stash; verify `git status`/`git diff` after any subagent file operations.
