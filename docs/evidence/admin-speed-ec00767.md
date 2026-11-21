# Admin console speed — measured on production build

Commit: ec00767 (measurement run; code under test = HEAD at run time)
Environment: `vite preview` production bundle, Fast 3G (150 ms RTT,
1.6 Mbps down / 750 Kbps up), 4x CPU throttle, 390 px viewport,
mid-range Android device profile. Script: `scripts/measure-admin-speed.mjs`.

| metric | value | budget | result |
|---|---|---|---|
| first useful screen (/app → Home) | 3094 ms | < 3000 ms | MISS by 94 ms |
| nav → Projects shell | 285 ms | < 100 ms | MISS |
| nav → Projects data | 289 ms | < 1500 ms | PASS |
| nav → Money shell | 97 ms | < 100 ms | PASS |
| nav → Money data | 452 ms | < 1500 ms | PASS |
| nav → People shell | 164 ms | < 100 ms | MISS |
| nav → People data | 433 ms | < 1500 ms | PASS |
| nav → Site shell | 171 ms | < 100 ms | MISS |
| nav → Site data | 397 ms | < 1500 ms | PASS |
| nav → Files & reports shell | 85 ms | < 100 ms | PASS |
| nav → Files & reports data | 433 ms | < 1500 ms | PASS |
| nav → Home shell | 319 ms | < 100 ms | MISS |
| nav → Home data | 343 ms | < 1500 ms | PASS |
| submit → disabled state | immediate (code-verified `disabled={busy}`) | immediate | PASS |
| submit → project visible | 30 581 ms | reported | reported |
| JS transferred | ~2 KiB measured (content-length absent on preview; entry chunk is 319.67 kB raw / 102.22 kB gzip) | — | — |
| total bytes transferred | 254 KiB | — | — |

## Honest reading

- **Data latency is fine**: every section's data lands < 0.5 s on Fast 3G.
- **Shell/skeleton misses are partly measurement artefacts**: the probe waits
  for `main h1` OR `[aria-busy]`; on sections already lazy-loaded there is no
  skeleton, so "shell" measures full section render under 4x CPU — i.e. it is
  closer to a data+render time. Sections never visited still show skeletons.
- **First screen misses by 94 ms** — inside noise on a shared dev machine,
  but reported as a miss per the no-tuning rule.
- **Submit → visible 30.6 s** includes project-create POST + full list
  refetch over throttled 3G with 4x CPU — the disabled state itself is
  immediate (`disabled={busy}` verified in `NewProjectModal.tsx`).
- Bundle: entry `index-*.js` 319.67 kB raw / 102.22 kB gzip — inside the
  450 kB / 140 kB CI budget (`scripts/check-bundle-size.sh`).

## Follow-ups (Phase 4)

- Per-project fetch loops and duplicate shell calls still to be removed.
- The "shell < 100 ms" probe should target the skeleton element specifically
  once skeleton coverage is uniform.
