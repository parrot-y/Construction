# DISCOVERY_PLAN.md — customer discovery before heavy build-out

**Date:** 2026-11-06 · **Status:** BLOCKED on R-026 — the existing `docs/research/DISCOVERY_GATE_SYNTHESIS.md` claims 9 interviews; owner must confirm they were real. If synthetic, this plan replaces it.

## Goal
Confirm the primary paying customer and validate pricing before building beyond M10 (per audit freeze H1).

## Who to interview (8–10 total)
- 3+ main contractors (NCA Cat 3–6, 5–50 staff) — current workflow observation, not a pitch
- 3+ QS/PMs — how they run BOQ, valuations, certificates today
- 2–3 developers/property owners (incl. 1 diaspora) — what they need to see/approve/pay

## Interview script (45–60 min, in the field or video call)
1. "Show me how you currently track a project's budget." (screen-share their spreadsheet/tool)
2. "Where is the BOQ? Who made it and how is it updated?"
3. "How do you know what has actually been spent vs certified?"
4. "How does the site supervisor report what was done today? Show me the last report."
5. "Walk me me through the last variation/change order — who approved it and how?"
6. "When a client disputes a cost or progress claim, how do you prove it?"
7. "How are valuations/payment certificates produced and approved?"
8. "How do you pay subcontractors and suppliers? What records do you keep?"
9. "What do you use today (Excel, paper, other SaaS)? What have you paid before?"
10. "What's the most frustrating part of running projects?"
11. Pricing probe: "Would you pay KES X per project/month for this? Per company?"
12. "May I see a real (redacted) BOQ or report you can share?"

## Evidence to capture per interview
- Current tool stack + monthly spend
- The actual artifact they use (BOQ sheet, site diary book, WhatsApp thread)
- Who signs off money and how
- Language they use (swahili/english terms for variations, certificates, retention)

## Decision this unblocks
- Primary buyer: contractor / developer / QS-PM (hypothesis: Main Contractor NCA Cat 3–6)
- Pricing model: per-project (KES 7,500/proj/mo?) vs portfolio (KES 25,000/mo?)
- MVP scope adjustments: which "Should" items become "Must"
- Whether client portal needs login or token links suffice

## PRD decisions dependent on interviews
- Buyer persona priority order
- Pricing hypothesis
- Whether M-Pesa project payments (not just billing) are MVP
- Whether eTIMS is pilot-blocking or post-pilot
