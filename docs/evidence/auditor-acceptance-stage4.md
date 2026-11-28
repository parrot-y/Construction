
## Amendment 2026-11-13 — product name SiteSafi (commit 2e560b7)

Auditor amended test 7: the product must show one honest name — **SiteSafi** —
and purge the benchmark competitor name (BuildSasa / Sasa), the old
placeholder Mjengo, and the spaced variant "Site Safi" from the inbox
payload, page body, document title and web-app manifest.

### Spec change (hash-locked file — owner review required)

- `e2e/tests/aud-stage4-consultant-compliance-field.spec.ts` replaced
  byte-for-byte with the amended spec.
- sha256: `6a53afa74cf96c2c6ba0ab065c8a978b6d6e5a45d87ed17880d05e851c23d45a`
  → `9073ff7482651dc092c27eac646ef4613279b61343e015e6530e0c98976ec9f8`
- `e2e/tests/aud-specs.sha256` updated accordingly; all other aud hashes
  unchanged.

### Product changes

- `PRODUCT_NAME` defaults changed `BuildSasa` → `SiteSafi` in
  `apps/web/src/lib/product.ts`, `apps/api/src/lib/product.ts`,
  `apps/web/vite.config.ts` (manifest name/short_name) and
  `apps/web/index.html` (`<title>`). Env override (`VITE_PRODUCT_NAME` /
  `PRODUCT_NAME`) still works for future rebrands.
- `e2e/tests/k-stage4-consultant-compliance-field.spec.ts` dev spec updated
  to the new contract (expects `SiteSafi`, forbids leftovers).

### Run output (real)

Failing-first: amended spec failed only on test 7 both viewports —
landing page rendered "BuildSasa" (14 passed, 2 failed).

After fix — `aud-stage4` alone: **16/16 passed** (8 chromium + 8 mobile-390).

Full suite single invocation (aud-stage1–5 + dev-tcc-all-paths +
dev-maker-checker): **112/112 passed, zero skipped** — 56 chromium +
56 mobile-390, 2.8m.

`verify-local.sh` on `2e560b7` → **LOCAL CI VERIFICATION COMPLETED
SUCCESSFULLY**: API **561/561** (62 files), web **118/118**, db **15/15**,
money **63/63**, permissions **9/9**. Log:
`docs/evidence/verify-2e560b7.log`.
