# 09 — UX findings

Strengths `[OBSERVED]`:
- **Empty states teach**: every empty module explains what it is and the first step ("Add the first contract you've signed…", 3-step commitment explainer).
- **WhatsApp-first**: quotes collected with client phone "we use this to send the quote on WhatsApp"; accept-on-phone link. Fits Kenyan reality.
- **Client privacy control**: per-photo/video toggle "Show these photos to the client in the portal" — internal issues (accidents, supplier problems) stay private; "written notes are never shown to the client."
- **Role preview**: "Viewing as" switcher; role manager with plain-language hierarchy descriptions distinguishing easily-confused roles (QS vs Trade Lead explicitly).
- **Approval limits as data**: "Approval Limit — max change order value this role can approve, ∞ Unlimited" — financial control without code.
- **Mobile-first field roles**: Worker/Foreman/Trade Lead descriptions emphasise mobile capture; Field App permission; video limits sized for field uploads.
- **Evidence language**: daily log "protects you in claims and disputes"; weather auto-capture; "No work day?" for non-working days.
- **Global search Ctrl+K** across projects/orders/people; currency display toggle; dark mode.
- **Onboarding tour** on first login (project → invite → AI checklist).
- **Trial banner** persistent with plan CTA.

Friction / gaps `[OBSERVED]`:
- Onboarding tour reappears (couldn't permanently dismiss in session).
- Currency shown USD by default for a Kenyan product — KES exists but USD-first may confuse local contractors [INFERRED].
- No visible eTIMS/tax-invoice integration — invoices have generic "Tax %" only.
- No SMS channel observed — WhatsApp/email only; SMS fallback absent for non-smartphone users [INFERRED].
- Client and contractor are separate account systems — a client can't accidentally see contractor areas (good) but cross-inviting requires the project Client tab flow.
- Module access list (36) vs sidebar (~30 pages) — "Tasks", "Action Plans", "Field View", "Jobs", "Bidding", "Buildflex Ai" have no dedicated page; discoverability may suffer [INFERRED].
- Single project in trial workspace — multi-project portfolio behaviour unverified.

For a Kenyan contractor specifically: the product thinks in trades (33-taxonomy), weather-aware scheduling, WhatsApp commerce, and claim/dispute evidence — strong local fit. Weaknesses vs local needs: no observed M-Pesa *project* payments (Paystack covers it for billing), no eTIMS, USD-default pricing presentation, no SMS.
