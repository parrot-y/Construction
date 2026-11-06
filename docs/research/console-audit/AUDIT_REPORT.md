# AUDIT_REPORT.md — Gate 0: buildsasa.com audit-first report

**Date:** 2026-11-06 · **Auditor:** Devin (CTO lead, taking over from Gemini) · **Scope:** public surface + console login surface + legal constraints. No in-app module walkthrough yet (that is Gate 1, pending approval).

Claim tags: `[OBSERVED]` seen directly · `[INFERRED]` deduced · `[ASSUMPTION]` unverified.

---

## a) Public surface

Marketing site `buildsasa.com` / `www.buildsasa.com` — Next.js on Railway (`x-powered-by: Next.js`, `server: railway-hikari`). `[OBSERVED]`

Sitemap (19 URLs) `[OBSERVED]`:
- Core: `/`, `/pricing`, `/service`, `/service-details`, `/about`, `/contact`, `/faq`, `/news`, `/privacy`, `/terms`
- Feature pages: `/feature-manage-field`, `/feature-change-orders`, `/feature-coordinate-documents`, `/feature-quality-safety`, `/feature-ai-assistant`
- Funnels: `/request-project`, `/site-reporting` ("Neutral Site Reporting"), `/for-clients` (property owners), `news-details`

Pricing page `[OBSERVED]`:
- Two plans: **Starter** (3 team members incl., unlimited projects, daily logs/photos/checklists/schedule, free client accounts, quotes/invoices/change orders, inspections/punch lists/safety) and **Business** (10 members, adds financials, BOQ & payment certificates, inventory/equipment/subcontractors, reports, onboarding & priority support).
- Billing: monthly, or yearly "two months free". **7-day free trial**.
- **Deployment: "In Our Cloud, or On Your Own Servers"** — self-hosted option with custom features/integrations `[OBSERVED]` — significant: they sell on-prem too.
- Contact: +254 782 223 749, hello@buildsasa.com, Westlands, Nairobi.
- Landing claims "SOC 2 Type II · ISO 27001" — marketing claim, unverified `[OBSERVED claim]`.

No public API docs, help centre, changelog, status page or app-store listing found in sitemap `[OBSERVED]`. Help appears to be "Ask Suzy" widget + FAQ.

## b) Console surface — console.buildsasa.com

Vite + React SPA (`/assets/index-*.js`, 3.0 MB bundle), theme key `constructai-theme` in localStorage (internal codename hint) `[OBSERVED]`.

**Entry flow** `[OBSERVED]`:
1. Landing: role select — "I'm a client" (property owner, Kenya or abroad) vs "I'm a contractor or service provider" (builders, fencers, drillers, solar/CCTV, landscapers, surveyors + site teams).
2. Contractor path → sign-in: work email + password, "Forgot?", "Enter Workspace", "Continue with Google" (OAuth via `api.buildsasa.com/api/auth/google`), link "New company? Create your company account", "Are you a client? Switch".

**Login succeeded** with owner-provided account `[OBSERVED]`:
- Workspace name shown as "POWELL", role "Contractor", currency USD.
- Banner: "4 days left on your free trial. Everything is unlocked until then."
- Dashboard is mostly empty (0 change orders, $0 approved CO value) — fresh/trial workspace.

**Post-login navigation** `[OBSERVED]`:
`Inbox · Dashboard · Announcements · Projects` (All projects, Change orders, Plans & drawings, Schedule, Daily log, Site checks, Checklists, Punch list, Observations) `· Money · Quality & safety · People · Documents & reports` — plus "Viewing as: Contractor" switcher (role switching exists `[OBSERVED]`), Ctrl+K global search, "New" create menu, currency selector (USD shown).

Onboarding modal: "Create your first project / Invite a teammate / Open the AI checklist tool" — confirms AI checklist feature and invite flow exist.

## c) Access options

- Existing account works — no signup needed (per addendum). `[OBSERVED]`
- Trial is active but **expires ~2026-11-10** — research window is short. `[OBSERVED]`
- "New company? Create your company account" exists on login — NOT used (owner said no new accounts). `[OBSERVED]`
- Client-side experience may need the "I'm a client" path — unknown whether same credentials work; to verify in Gate 1 or ask owner.
- No public sandbox/API docs found.

## d) Passive tech fingerprint

| Layer | Finding | Tag |
|---|---|---|
| Marketing | Next.js, Railway hosting, edge `iad1` | OBSERVED |
| Console | Vite React SPA, static assets, Railway | OBSERVED |
| API | `api.buildsasa.com` — **Express** (`x-powered-by: Express`), Railway, `/api/health` → 200 JSON | OBSERVED |
| Auth | Email/password + Google OAuth (`/api/auth/google`, `/api/auth/google/exchange`, verify-email, forgot/reset, resend-verification) | OBSERVED |
| API surface | **77 endpoints** enumerated from bundle — see appendix | OBSERVED |
| Maps/geo | Leaflet + OpenStreetMap, Nominatim + Photon geocoding | OBSERVED |
| Weather | api.open-meteo.com | OBSERVED |
| PDF | pdfkit (pdfobject viewer) | OBSERVED |
| Comms | wa.me/254782223749 WhatsApp link | OBSERVED |
| Uploads | `/api/upload`, `/api/upload/batch`, `/api/upload/presign` — presigned-URL pattern ⇒ S3-compatible object storage | INFERRED |
| AI | `/api/ai/*` (assistant, chat, checklist generation, design), `/api/ai-credits` + checkout/verify — **AI features are metered/billed separately** | OBSERVED |
| Billing | `/api/billing/{plans,subscription,invoices,seats,checkout,verify}` — seat-based SaaS billing | OBSERVED |

**Module map implied by endpoints** `[OBSERVED]`: projects/jobs, change-orders, quotes, invoices (billing + field), checklists + templates (incl. CSV/parse-from-document), punch, observations, coordination-issues, correspondence, action-plans, attendance, crews, subcontractors (+payments), equipment, inventory (+low-stock), cost-codes, rate-library, bid-packages, form-templates, documents (+company-docs), scheduled-reports, announcements, conversations, directory-contacts, access-logs, dashboard/insight, support/chat, email status/test, client/* portal endpoints (companies, jobs, project-requests, quotes, reporting), users/invite.

## e) Legal & technical constraints

- `robots.txt` marketing: `Allow: /` + sitemap. Console host serves SPA for `/robots.txt` (no disallow rules). `[OBSERVED]`
- Terms `[OBSERVED]`: prohibits unauthorised access, **reverse-engineering, copying, reselling, derivative works**, interference/overload, circumventing usage limits. No explicit anti-crawling clause found. Our approach — manual-rate, own-account, read-only UI observation — is ordinary product use; we do NOT reverse-engineer or copy. Bulk automated scraping of the app would be a grey zone → we keep request rates low and prefer UI observation.
- Rate limiting: OPTIONS preflights observed (CORS enabled); no evidence of aggressive bot protection on console.
- ToS acceptance happens at login ("By continuing with Google you agree…") — passive browsing already implies acceptance; our use stays within normal-use bounds.

## f) Proposed crawl plan (Gate 1, pending approval)

Order (highest value first, all within the Contractor workspace unless noted):
1. Projects module: create-project form fields (no save), project detail tabs, statuses.
2. Change orders: list → detail → statuses → approval chain (core differentiator).
3. Checklists + AI checklist tool; Punch list; Observations; Site checks; Daily log.
4. Money: quotes, invoices, budgets/BOQ, payment certificates, subcontractor payments.
5. Plans & drawings; Schedule; Documents & reports; Scheduled reports.
6. People: users, crews, roles, invites (ask owner before inviting); Viewing-as switcher.
7. Quality & safety; Inventory/equipment (under Money/People trees).
8. Inbox/Announcements/Correspondence; AI assistant; Support chat.
9. Billing & plans screens (before trial expires); Documents upload flow.
10. Client path: attempt "Switch"/client login with same creds; else mark "Not reachable" and infer from `/api/client/*` + marketing pages.

Method: puppeteer-core scripts, ~1 action/2 s, screenshots per step, field tables per skill `workflow-mapping`. Everything read-only; dummy `ZZ-RESEARCH-` records only with owner approval.

## g) Gaps & corrections to assumptions

1. **Product shape differs from our earlier parity audit.** Buildsasa is organised around **change orders, checklists, punch/observations, daily logs, plans/drawings, crews, quotes/invoices** — a contractor field-ops + commercial tool — not primarily valuations/BOQ/certificates (those exist under Business tier: "BOQ & payment certificates"). Our MjengoLedger is heavier on BOQ/valuations/retention. Both matter; the overlap is large but the emphasis differs. `[INFERRED]`
2. **Two-sided market confirmed**: contractors AND property owners (diaspora) are both first-class funnels. `[OBSERVED]`
3. **Self-hosted offering** means enterprise buyers exist; our SaaS-only posture may miss that segment — note as opportunity/threat.
4. **AI is a billed feature** (ai-credits checkout) — they've productised AI usage; we should note pricing/UX of that.
5. **Assumption correction**: earlier doc claimed "8 stakeholder portals / tender board / inspections" parity — those features exist (bid-packages, client endpoints, site-reporting page) but the console nav we observed is more field-ops-centric. Re-verify in Gate 1 before relying on the parity report.
6. Trial expiry is a hard deadline for account-based research.

## Appendix: API endpoints (from public JS bundle)

77 paths under `https://api.buildsasa.com` — grouped: auth(7), billing(6), ai(7), projects/jobs(3), change-orders, quotes, punch, observations, checklists(+templates 4), attendance, crews, subcontractors(+payments), equipment, inventory(2), cost-codes, rate-library(2), bid-packages, form-templates, documents/company-docs, scheduled-reports, announcements, conversations, correspondence, action-plans, coordination-issues, directory-contacts, access-logs, dashboard/insight, support/chat, email(2), upload(3), client portal(6), company, me, users(+invite), login, signup, health.

## Open questions for owner

1. Trial expires ~Nov 10 — extend, or prioritise modules?
2. Is this account Contractor-only, or can we reach client/other roles via "Viewing as"?
3. R-026 still open: were the 9 "discovery interviews" real? (blocks Discovery Gate regardless of this research)
