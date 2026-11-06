# 06 — Integrations

From JS bundle endpoints + UI observations. `[OBSERVED]` unless tagged.

| Integration | Evidence | How used |
|---|---|---|
| **Paystack** | Billing page: "Secure payments via Paystack · M-Pesa, card & bank" | Subscription billing (Starter/Business monthly/yearly), AI credits checkout (`/billing/checkout`, `/ai-credits/checkout`, `/verify`), possibly client invoice payments |
| **Google OAuth** | "Continue with Google" → `/api/auth/google`, `/exchange` | Sign-in alongside email/password; email verify/forgot/reset/resend endpoints exist |
| **WhatsApp** | wa.me/254782223749 site-wide; quote form collects client WhatsApp "we use this to send the quote on WhatsApp"; `/public/quotes/:id` accept-on-phone | Quote delivery + client acceptance; support contact |
| **AI suite ("Buildflex Ai" / "Ask Buildsasa AI" / "Shemmy")** | `/api/ai/{assistant,chat,design,designs,build-checklist,generate-checklist,extract-checklist-from-document}`, `/ai-credits` metering, AI schedule generator, "AI Design — SOON" on drawings, "Ask Buildsasa AI…" input in role manager | Metered AI: checklists from paper/PDF, schedule drafting, design concepts (coming), assistant/chat, support bot "Shemmy" |
| **Maps/geocoding** | Leaflet + OpenStreetMap tiles, Nominatim reverse geocode, Photon search, Google Maps link | "Use my location"/"Pick on map" on quotes, daily logs, projects ("Set location" → weather) |
| **Weather** | api.open-meteo.com | Project location pinning → "whether it's a good day to build"; daily-log weather Auto option |
| **File storage** | `/upload`, `/upload/batch`, `/upload/presign` | Presigned-URL uploads ⇒ S3-compatible object storage [INFERRED]; drawings accept PDF/images/CAD; daily-log video ≤20MB; company logo |
| **PDF** | pdfkit + pdfobject viewer | Reports export PDF; quote/invoice documents likely generated server-side |
| **QR codes** | api.qrserver.com | Portal/document QR generation [INFERRED] |
| **Email** | `/email/status`, `/email/test` | Invites, quote sends, notifications [INFERRED] |
| **In-app messaging** | `/conversations` (Inbox), client `/messages`, `/threads`, `/client-messages` | Team chat + client↔contractor messaging |
| **Scheduled reports** | `/scheduled-reports` | Automated report delivery [INFERRED email/WhatsApp] |

## Public/unauthenticated surface `[OBSERVED]`
`/api/public/portal/:token` (+ change-orders, selections), `/api/public/quotes/:id` (+respond), `/api/public/bids/:id`, `/api/public/forms/:id` (+submit), `/api/signup`, `/api/login`, auth flows, `/api/health`. Token-based capability access for clients/subcontractors without accounts.

## Client portal endpoints (account-based) `[OBSERVED]`
`/api/client/{me,home,jobs,projects,quotes,companies,project-requests,reporting}` + project comments/messages/threads, bids award/decline, company rating.

## Not observed / not reachable
- Native mobile app (PWA/responsive web only observed; "Field App" is a permission, not an app listing).
- Accounting integration (QuickBooks/Xero) — none seen; they built their own ledger.
- eTIMS/VSCU — no evidence in bundle [ASSUMPTION: not integrated; Kenya tax invoicing may be manual].
- SMS gateway — none seen; WhatsApp + email are the channels.
