# Skill: competitor-audit-and-crawl

## When to use
Any time we study an external product or website (competitor, inspiration, integration docs). Mandatory before Gate 0 research on buildsasa.com.

## Ground rules (never break)
1. Only access public pages, or a trial/demo/paid account the owner legitimately provides. Never bypass logins, paywalls, rate limits, or access controls. Never touch other tenants' data or tamper with URLs/IDs.
2. Check `robots.txt` and Terms of Service FIRST. If ToS forbids automated access or competitive analysis, STOP and tell the owner; switch to manual click-through in the account.
3. Polite crawling: ~1 request per 1–2 s, sequential, no parallel hammering, no fuzzing, no load testing.
4. Never store real personal/customer data. Record field names, types, statuses, workflow behaviour only. Redact names, phones, amounts, documents in screenshots.
5. Never copy code, branding, copy, images or icons. Document behaviour and structure only.
6. No real payments, no real messages through any integration.

## Procedure
1. **Scope**: list coverage areas (marketing pages, console login surface, in-app modules) and write them into the plan file before starting.
2. **ToS check**: fetch `/terms`, `/privacy`, `robots.txt`. Quote the relevant clause in the audit report.
3. **Passive fingerprint**: response headers (`server`, `x-powered-by`), HTML framework signatures, JS bundle URLs, known third-party domains in the bundle (auth, payments, SMS, maps, storage).
4. **Safe crawl**: fetch pages sequentially with delay; save HTML to `docs/research/<target>/pages/`; screenshot naming: `NN-step-description.png`.
5. **Account exploration** (only with owner-provided credentials): log in via browser automation, explore read-only, open forms without saving. If a workflow step requires saving, STOP and ask; if approved use records prefixed `ZZ-RESEARCH-` and log every created record in `CREATED_RECORDS.md`.
6. **Resumable progress**: keep `PROGRESS.md` with areas done / remaining / blocked, so work survives interruption.

## Checklist
- [ ] robots.txt + ToS fetched and quoted
- [ ] No auth bypass, no other-tenant access, no URL/ID tampering
- [ ] Request rate ≤ 1 per 1–2 s, sequential only
- [ ] All real data redacted in screenshots and notes
- [ ] Nothing copied — behaviour documented, not assets
- [ ] CREATED_RECORDS.md exists and lists anything created (or states "none")
- [ ] PROGRESS.md updated

## Output template
`AUDIT_REPORT.md` sections: a) public surface b) login surface c) access options d) tech fingerprint e) legal/technical constraints f) proposed crawl plan g) gaps & corrections to assumptions.

## Common mistakes
- Treating "the account is ours to explore" as licence to submit/approve/pay real records — read-only unless owner approves a dummy record.
- Screenshotting dashboards with real customer names unredacted.
- Parallel fetches "to save time" — this gets IPs blocked and violates the polite-crawl rule.
- Assuming a marketing claim (SOC 2, ISO) is verified — mark `[OBSERVED marketing claim]` only.
