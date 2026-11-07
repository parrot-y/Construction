# CREATED_RECORDS.md

Log of every record created inside the buildsasa.com console account during research, so the owner can clean up. Prefix all research records with `ZZ-RESEARCH-`.

| Date | Record type | Identifier / name | Action needed |
|---|---|---|---|
| 2026-11-06 | Change order | **CO-4990** — "ZZ-RESEARCH-DO NOT ACT: boundary wall" (MAKUNDI APARTMENTS, Owner request, $100, +2d, ended status **Approved**) | Delete or Void in Change orders list |
| 2026-11-06 | Daily log | **Fri 6 Nov entry** — "ZZ-RESEARCH test entry: scaffold inspection and material check. Safe to delete." (4 labour-days, crew "ZZ-RESEARCH Crew") | Delete/edit in Daily log → Friday cell |
| 2026-11-06 | Quote | **Q-0001** — "ZZ-RESEARCH-DO NOT ACT: boundary wall quote" (client "ZZ-RESEARCH Client", $4,235 / KES 550,000). Status now **Accepted by Brenda Kosgei** — client email was changed to the owner's test client account and the real client accepted it via typed-name e-signature. **"Start project" action is now live on this quote — do NOT click it.** | Delete/decline in Quotes list; client account sees it under Quotes & proposals |

Notes:
- Login was performed with the owner-provided account (role observed: Contractor, workspace "POWELL", currency USD, free trial).
- The quote was marked **Sent** during the send-flow test — its share link points to a fake client (`zz-research@example.com`), so nothing was delivered anywhere real. No emails/WhatsApps were actually dispatched by us; "Send" only generates the link + status change.
- The CO was advanced Drafted → PM Review → Approved during lifecycle testing. It is a dummy $100/+2d record on the test project.
- The daily log is text-only (no photos/video attached), so nothing was exposed to the client portal beyond what the written-notes rule already hides.
- Credentials were never written to any file, screenshot, or log.
| 2026-11-06 | Invoice | **ZZ-RESEARCH-INV-001** — "ZZ-RESEARCH Client", draft status, balance shown (MAKUNDI APARTMENTS) | Delete in Invoicing list |
| 2026-11-06 | Commitment | Attempted "ZZ-RESEARCH Subcontractor" — POST fired but validation rejected; **no record created** | None needed |
| 2026-11-06 | Certificate | Form opened but save blocked — contract sum prerequisite not set; **no record created** | None needed |
| 2026-11-06 | Payment application | **#ZZ-APP-01** — Nov 2026, Draft, $0 amounts (number fields partially filled), MAKUNDI APARTMENTS | Delete in Financials → Applications |
| 2026-11-06 | Punch item | **PL-2419** — "ZZ-RESEARCH-DO NOT ACT: cracked tile", ZZ-RESEARCH Zone Level 1, Open | Delete in Punch list |
| 2026-11-06 | Contract sum | MAKUNDI APARTMENTS contract sum set to dummy **$1,000,000** (+ start/finish dates) via `PUT /api/projects/{id}/contract`; revised contract sum now shows $1,000,100.10 | Reset contract sum to 0/unset in Variations tab |
| 2026-11-06 | Certificate form | Opened "Record certificate" with test values ($1,000,000 period / 10% retention) — computed NET PAYABLE looked wrong, form **cancelled, nothing saved**. Note: #ZZ-APP-01 already appears in certificate history (payment applications and certificates share one record model) | None — verify no stray certificate row beyond #ZZ-APP-01 |
