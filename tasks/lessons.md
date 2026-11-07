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
