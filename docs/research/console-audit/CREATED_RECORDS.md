# CREATED_RECORDS.md

Log of every record created inside the buildsasa.com console account during research, so the owner can clean up. Prefix all research records with `ZZ-RESEARCH-`.

| Date | Record type | Identifier / name | Action needed |
|---|---|---|---|
| 2026-11-06 | Change order | **CO-4990** — "ZZ-RESEARCH-DO NOT ACT: boundary wall" (MAKUNDI APARTMENTS) — **CLEANED UP 2026-11-07: status Rejected** (no hard delete exists; Reject is the terminal action). Still visible in lists/activity as Rejected | None — rejected records remain in audit trail by design |
| 2026-11-06 | Daily log | **Fri 6 Nov entry** — text neutralized 2026-11-07 to "General site supervision and progress monitoring." / crew "Site crew" (no delete exists; edit is the only path). 4 labour-days remain counted for that date | None — or owner may edit/delete manually if a delete exists in UI |
| 2026-11-06 | Quote | **Q-0001** — "ZZ-RESEARCH-DO NOT ACT: boundary wall quote" — status **Accepted by Brenda Kosgei** (real client account accepted during E2E test). **No delete/decline path found on Accepted quotes — "Start project" must NOT be clicked.** Client sees it under Quotes & proposals | Manual cleanup only: contact Buildsasa support or wait for trial expiry; do NOT click Start project |

Notes:
- Login was performed with the owner-provided account (role observed: Contractor, workspace "POWELL", currency USD, free trial).
- The quote was marked **Sent** during the send-flow test — its share link points to a fake client (`zz-research@example.com`), so nothing was delivered anywhere real. No emails/WhatsApps were actually dispatched by us; "Send" only generates the link + status change.
- The CO was advanced Drafted → PM Review → Approved during lifecycle testing. It is a dummy $100/+2d record on the test project.
- The daily log is text-only (no photos/video attached), so nothing was exposed to the client portal beyond what the written-notes rule already hides.
- Credentials were never written to any file, screenshot, or log.
| 2026-11-06 | Invoice | **ZZ-RESEARCH-INV-001** — "ZZ-RESEARCH Client", draft, $385 (MAKUNDI APARTMENTS). **No delete/edit affordance found — draft invoices cannot be removed via UI** | None possible via UI; trial expiry will wipe |
| 2026-11-06 | Commitment | Attempted "ZZ-RESEARCH Subcontractor" — POST fired but validation rejected; **no record created** | None needed |
| 2026-11-06 | Certificate | Form opened but save blocked — contract sum prerequisite not set; **no record created**. Note: #ZZ-APP-01 appears in Certificates history (applications & certificates share one record model) | None needed |
| 2026-11-06 | Payment application | **#ZZ-APP-01** — Nov 2026 — **CLEANED UP 2026-11-07: Rejected** via Reject modal (comments field + confirm) | None — rejected, remains in audit trail |
| 2026-11-06 | Punch item | **PL-2419** — "ZZ-RESEARCH-DO NOT ACT: cracked tile" — **CLEANED UP 2026-11-07: Rejected** (no hard delete; Reject is terminal) | None — rejected, remains in audit trail |
| 2026-11-06 | Contract sum | ~~$1,000,000~~ **RESET TO 0 on 2026-11-07** via project → "More project actions" → "Contract value & dates" (`PUT /projects/{id}/contract`). Editor copy: "The agreed sum is the base every variation and certificate is measured against… Shown on the project card as '0'" | Done — verified $0 |
