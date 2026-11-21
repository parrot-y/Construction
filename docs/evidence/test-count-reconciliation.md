# API test-count reconciliation (A2)

Question from audit: committed verify logs show API totals of 525 (55 files)
and 561 (62 files) at different points, vs 586 (66 files) latest. Every
difference is accounted for below. **No test file was ever deleted or
renamed** (`git log --all --diff-filter=D` over `apps/api/src/**/*.test.ts`
returns nothing) and the latest log contains **zero skipped tests**.

## Totals timeline (committed `docs/evidence/verify-<sha>.log`)

| Commit | Date | API tests | API files |
|---|---|---|---|
| 39f57c3 | 2026-11-09 | 525 | 55 |
| 0d38faf | 2026-11-11 | 561 | 62 |
| 56101c6 | 2026-11-13 | 578 | 65 |
| 65fe169 / be1364e | 2026-11-13 | 586 | 66 |

## 525 → 561 (+36 tests, +7 files) — lifecycle hardening phase

Per-file counts extracted from `verify-39f57c3*.log` vs `verify-0d38faf*.log`
(`✓ src/… (N tests)` lines). All seven files are **new**; no existing file's
count changed:

| File | Tests | Added in |
|---|---|---|
| onboarding.test.ts | 4 | f6e3f6f |
| notifications.test.ts | 5 | f6e3f6f |
| lifecycle-money.test.ts | 6 | f6e3f6f |
| invitations-lifecycle.test.ts | 7 | f6e3f6f |
| projects-visibility.test.ts | 2 | f6e3f6f |
| account-lifecycle.test.ts | 9 | 4c5c8b5 |
| operator-activation.test.ts | 3 | c53e406 |

Sum: 4+5+6+7+2+9+3 = **36** → 525+36 = 561, 55+7 = 62 files. ✓

## 561 → 578 (+17 tests, +3 files) — staging hardening (65fe169)

| File | Tests |
|---|---|
| company-export.test.ts | 8 |
| lib/pagination.test.ts | 4 |
| log-redaction.test.ts | 5 |

Sum: **17** → 561+17 = 578, 62+3 = 65 files. ✓

## 578 → 586 (+8 tests, +1 file) — CTO audit fixes (be1364e)

| File | Tests |
|---|---|
| audit-hardening.test.ts | 8 |

Sum: **8** → 578+8 = 586, 65+1 = 66 files. ✓

## Verification

- `git log --all --diff-filter=D -- 'apps/api/src/**/*.test.ts'` → empty.
- `grep -c "skipped" docs/evidence/verify-65fe169.log` → 0.
- Per-file diff `verify-39f57c3` vs `verify-65fe169`: only `>` additions,
  no count changes in pre-existing files.
