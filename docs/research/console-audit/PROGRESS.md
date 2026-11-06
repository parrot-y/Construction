# PROGRESS.md — buildsasa.com console research

Resumable progress tracker. Update after every session.

**Last updated:** 2026-11-06 (Devin)
**Status:** GATE 1 substantially complete — deliverables written; awaiting owner review before Gate 2 synthesis.

## Environment notes
- Automation: `puppeteer-core` + system `/usr/bin/google-chrome` (headless). Scripts in `/tmp/sasa-audit/` (ephemeral — recreate if wiped).
- Credentials passed via env vars `SASA_EMAIL` / `SASA_PASSWORD` at runtime only — never stored.
- Screenshots: `screenshots/`; page DOM dumps: `pages-dom/*.json`; API map: `api-endpoints-full.txt` (250 paths).

## Done — Gate 1 coverage
- [x] All sidebar modules visited and dumped (~35 pages)
- [x] ~20 create/edit forms captured read-only (CO, quote, invoice, commitment, daily log, observation, RFI, incident, correspondence, inspection, contact, crew, invite, subcontractor, checklist template, AI schedule)
- [x] Project detail page (MAKUNDI APARTMENTS): 13 tabs + health signals captured
- [x] 14-role catalogue + 18-permission matrix extracted for ALL roles (`rolematrix2-*.json`)
- [x] Module access catalogue (36 modules)
- [x] Client path tested: separate account system; contractor creds rejected on client login
- [x] Pricing/plans/billing captured incl. Paystack, AI credits, self-hosted
- [x] Deliverables: 01_overview … 10_opportunities, SUMMARY.md, 03_workflows/README.md, 04_journeys, 05_data_model (ERD), 06_integrations, 07_sitemap, 08_pricing

## Owner plan (2026-11-06)
Owner will create additional trial accounts (14-day) for other roles while Claude audits PR #1. Protocol ready: `ROLE_SIMULATION_PROTOCOL.md` — 7 role accounts needed, per-role capture checklist, 7 end-to-end simulation scenarios (S1–S7). Team invites into POWELL workspace preferred for staff roles; client needs Client-tab invite (record creation — will ask before sending).

## Not done / Not reachable
- [ ] Client dashboard interior — needs client invite (requires creating data; ask owner)
- [ ] Saved-record workflows (statuses beyond empty states) — would need ZZ-RESEARCH- records; ask owner if wanted
- [ ] Module-access toggle granularity per role — permission toggles captured; module list appears derived [INFERRED]
- [ ] "Viewing as" role preview mechanics — partially observed
- [ ] Bidding flow detail (no jobs/bid-packages in this workspace)
- [ ] Ask Buildsasa AI / Shemmy chat — not exercised
- [ ] Upload flow end-to-end (presign observed in bundle only)

## Blockers / flags
- **Trial expiry ~2026-11-10** — if it lapses, remaining items become "Not reachable" permanently.
- R-026 (real interviews?) still unanswered — blocks Discovery Gate.
- No records created in account (CREATED_RECORDS.md clean).
