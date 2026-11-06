# PRD.md — MjengoLedger (Gate 2 synthesis output)

**Date:** 2026-11-06 · **Status:** DRAFT for owner approval · **Depends on:** customer discovery (see DISCOVERY_PLAN.md) for buyer confirmation.

## Vision
Kenya-first construction management SaaS: the QS-grade financial spine (BOQ → budget → progress → cost → evidence → approval → client visibility) wrapped in field-ops workflows Kenyan contractors actually use daily — M-Pesa payments, WhatsApp quotes, SMS/WhatsApp comms, KRA/eTIMS readiness, offline site use, KES pricing.

## Personas (V1)
1. **Contractor / Company Admin** — SME main contractor (NCA Cat 3–6 hypothesis). Buys the tool; needs portfolio control, approvals, money.
2. **PM/QS** — runs projects; BOQ, budgets, valuations, certificates, COs.
3. **Site Supervisor** — daily logs, photos, progress, snags, attendance; mobile, offline, low-bandwidth.
4. **Client/Developer** — follows progress, approves COs/valuations, pays invoices; often diaspora → web portal, WhatsApp, multi-currency view.

(Expansion personas mapped in MVP_SCOPE: Architect, QA/QC, Owner, Executive, Site Engineer, Trade Lead/Foreman/Worker, Viewer — all via permission presets later.)

## User stories (MVP, acceptance in Given/When/Then at slice level)
- As a contractor, I can create a project and invite my team with roles, so work is scoped.
- As a QS, I can import a messy Kenyan BOQ spreadsheet and get a clean priced structure.
- As a supervisor, I can log today's site work offline with photos and it syncs when back in coverage.
- As a PM, I approve costs/variations/valuations with a full audit trail.
- As a client, I see stage photos (only what contractor shares), progress %, pending approvals, and can pay via M-Pesa.
- As an admin, every shilling is traceable: budget → cost → certificate → invoice → payment → retention.

## What we keep / simplify / drop vs Buildsasa (synthesis)
- **Keep:** change-order approval chain w/ limits; client portal + per-photo privacy; WhatsApp quote flow; daily-log-as-evidence; inspection→punch→close loop; crew/trade taxonomy; role-based permissions.
- **Simplify:** 14 roles → 4 V1 roles + presets; 36 modules → phased; USD-default → KES-first; per-seat → per-project pricing hypothesis.
- **Drop/defer:** self-hosted, AI-credit metering complexity, bidding marketplace, 30+ trade taxonomy breadth (start building trades, expand).
- **Beat them on:** eTIMS compliance path, SMS fallback, offline-first sync, M-Pesa project payments, KES pricing, QS-grade BOQ/valuation depth.

## Success metrics
- Pilot conversion: ≥1 real contractor company active weekly.
- Core loop completion: BOQ→diary→CO/variation→certificate→client view in one project.
- Payment: M-Pesa subscription live post-pilot.
- Qualitative: contractor says it replaces spreadsheet+WhatsApp chaos.

## Open questions (flagged for discovery)
- Buyer: contractor vs developer vs QS/PM? (R-002/R-026)
- Pricing: per-project vs per-company vs per-contract-size?
- Does the client portal need its own login or is token-link enough for MVP?
- Which integrations are must-have at pilot: M-Pesa billing only, or also project payments?
