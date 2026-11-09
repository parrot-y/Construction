# 07 — Sitemap & navigation

## Public marketing site (reference-platform.example) `[OBSERVED]`
`/` · `/pricing` · `/service` · `/service-details` · `/about` · `/contact` · `/faq` · `/news` (+`/news-details`) · `/privacy` · `/terms` · `/request-project` · `/site-reporting` (Neutral Site Reporting) · `/for-clients` (property owners) · feature pages: `/feature-manage-field`, `/feature-change-orders`, `/feature-coordinate-documents`, `/feature-quality-safety`, `/feature-ai-assistant`

## Console (console.reference-platform.example) — SPA, no URL routes observed (state-driven) `[OBSERVED]`

```
Landing: role select (Client | Contractor) → auth (email/pass | Google | Forgot) → "New company? Create account"
Workspace shell:
├── Inbox ── conversations, New group
├── Dashboard ── CO pipeline analytics, trial banner, onboarding tour
├── Announcements ── pinned/urgent, audience targeting
├── Projects
│   ├── All projects ── filters Active/At Risk/Planning/Closing/Archived; project cards
│   ├── Change orders ── list/CSV/New; statuses Drafted→PM Review→Owner Approval→Approved/Rejected/Void
│   ├── Plans & drawings ── disciplines filter, AI Design (SOON), Upload
│   ├── Schedule ── Gantt/List/Milestones, AI schedule
│   ├── Daily log ── per-day cards, labour/photos/deliveries counters
│   ├── Site checks ── (routes to Daily log view)
│   ├── Checklists ── Templates/Assignments by trade/My checklists; Upload, Form Builder, AI
│   ├── Punch list ── 30+ trades, statuses Open→…→Closed/Rejected
│   └── Observations ── Quality/Safety/Environmental/Commissioning + corrective actions
├── Money
│   ├── Financials ── Overview/Ledger/BOQ/Commitments/Applications/Retention; Excel/PDF export
│   ├── Commitments ── subcontracts/POs, claims, what's owed
│   ├── Quotes ── templates, WhatsApp share, convert to project
│   ├── Invoicing ── AR, draft/sent/paid/overdue
│   ├── Inventory ── Materials/Equipment tabs, stock-movement ledger, low-stock
│   └── Billing & plan ── subscription, plans, seats, invoices
├── Quality & safety
│   ├── Inspections ── template-driven, consultant approval chain
│   └── Safety incidents ── OSHA-style types, severity, corrective action
├── People
│   ├── Directory ── contacts by category
│   ├── Subcontractors ── sub/supplier DB, payments
│   ├── Crews ── rosters by trade/shift/foreman
│   ├── Team ── invite members w/ roles
│   ├── Attendance ── check-in/out, history, access log
│   └── Role manager ── 14 roles × modules+permissions+approval limit
├── Documents & reports
│   ├── Reports ── Financial/Operational/By Project/By Region/Custom/Scheduled; PDF export
│   ├── Company documents ── categorized file vault
│   ├── Correspondence ── Letter/Submittal/Transmittal/Notice
│   └── Coordination issues ── RFI/Clash/Design Question
└── Global: Ctrl+K search · New (CO/Project/Daily log/Schedule activity/Ask AI) · currency KES⇄USD ·
    notifications · dark mode · Viewing-as role preview · Ask the reference platform AI · Shemmy support · user menu
```

## Project detail tabs `[OBSERVED]`
Overview · Analytics · Contract · Drawings · BOQ · Variations · Certificates · Finishes · Site · Cost control · Client · Reports · Closeout
