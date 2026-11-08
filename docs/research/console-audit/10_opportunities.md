# 10 — Opportunities for Platform

Where we can beat the reference platform for the Kenyan market `[INFERRED]` — validate in Gate 2/customer discovery.

1. **KES-first, M-Pesa-native money**: they bill in USD via Paystack and show USD by default. We can default KES, price transparently in KES (their own page admits ~KES 2,990/8,970), and do M-Pesa STK for *project* payments (client paying contractor, subcontractor payments) — they only show Paystack for SaaS billing; project payment collection path unverified.
2. **eTIMS/VSCU compliance**: no evidence they integrate KRA eTIMS. Statutory tax invoices are mandatory for B2B in Kenya — a real wedge if we integrate properly (sandbox-first per our kenya-integrations skill).
3. **SMS-first fallback**: WhatsApp assumes smartphones/data. SMS (Africa's Talking) for critical alerts (approval requests, daily-log nudges, invoice links) reaches feature phones and low-data users.
4. **BOQ/valuation depth**: their Financials has BOQ/certificates but the centre of gravity is field ops + change orders. Our EASMM BOQ import, valuations/certificates, retention (10%/5% cap JBC-style), variations engine is deeper on the QS side — position as "the QS-grade tool".
5. **Offline-first site use**: they have "Field App" permission and photo uploads, but no observable offline queue/sync. Our ADR-004 offline PWA with idempotent sync is a differentiator on dead-zone sites.
6. **Simpler role model**: 14 roles + 36 modules + 18 permissions is powerful but heavy for a small contractor. Our 4-role V1 (admin, PM/QS, supervisor, client) with permission-based RBAC is easier to onboard — we can offer their depth later as configuration.
7. **Price**: $23–69/mo ≈ KES 3k–9k + per-seat overage. A per-project pricing (e.g. KES 7,500/project/mo hypothesis) may undercut for small contractors.
8. **Localisation**: they cover civil trades too (roads, bridges, asphalt) — broader than pure building. Decide: match breadth or dominate building vertical first.
9. **AI**: they meter AI via credits — good model to copy conceptually; our AI features (BOQ suggestions, diary summaries) can be simpler/free-tier friendly.
10. **Self-hosted**: they offer it — enterprise differentiator we likely can't match as solo founder; note as their moat, not our fight.

Things to KEEP (table stakes they proved): change-order approval chain with limits, client portal with per-photo privacy, WhatsApp quotes, daily-log-as-evidence, inspection consultant workflow, punch/observation/RFI triad, crew/attendance, role manager.
