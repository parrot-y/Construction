# 01 — Product overview: the reference platform (console.reference-platform.example)

All findings `[OBSERVED]` in our own Contractor trial account unless tagged otherwise. Account: workspace company "CLIENTCO CONTRACTORS", user "CONTRACTOR-CO", role Contractor, display currency USD, ~4 days trial remaining at audit date (2026-11-06).

## Positioning
"AI-powered construction, simplified." All-in-one construction management for contractors AND property owners (diaspora-friendly). Tagline claims: SOC 2 Type II, ISO 27001 (marketing claim, unverified). Built in Nairobi (Westlands); cloud or self-hosted.

## Two-sided product
- **Contractor side** (`console.reference-platform.example`, "I'm a contractor or service provider"): full workspace — projects, field ops, money, team, documents.
- **Client side** ("I'm a client"): separate free account for property owners — "see photos and videos of every stage… approve changes, pay invoices and chat with your contractor." Client accounts are NOT the same login — our contractor credentials were rejected with "This is a company account, not a client account." `[OBSERVED]` Clients are invited per-project via the project's **Client tab** and "create their own free account and password" `[OBSERVED in invite UI]`.

## Navigation tree (Contractor workspace) `[OBSERVED]`
``
Inbox (team conversations) · Dashboard · Announcements
Projects
  All projects · Change orders · Plans & drawings · Schedule · Daily log · Site checks
  Checklists · Punch list · Observations
Money
  Financials · Commitments · Quotes · Invoicing · Inventory · Billing & plan
Quality & safety
  Inspections · Safety incidents
People
  Directory · Subcontractors · Crews · Team · Attendance · Role manager
Documents & reports
  Reports · Company documents · Correspondence · Coordination issues
Global: Ctrl+K search · New menu · currency switch (KES/USD display) · notifications · dark mode ·
        "Viewing as" role preview · Ask the reference platform AI · Shemmy support chat · trial banner
```

## Module access catalogue (36 modules, from Role manager) `[OBSERVED]`
Dashboard, Billing, Projects, Schedule, Change Orders, Plans, Tasks, Documents, Daily Log, Attendance, Punch List, Commitments, Financials, Reports, Team, Field View, Inbox, Announcements, Observations, Action Plans, Coordination, Correspondence, Crews, Directory, Subcontractors, Company Docs, Role Manager, Jobs, Bidding, Quotes, Invoicing, Inspections, Checklists, Safety Incidents, Equipment, Buildflex Ai.

Note: "Tasks", "Action Plans", "Field View", "Jobs", "Bidding", "Buildflex Ai" exist in the permission/module catalogue but have no dedicated sidebar page — they surface inside projects or via AI.

## Key workflows implied by API surface `[OBSERVED from bundle]`
- Quote → share (WhatsApp link) → client responds (`/api/public/quotes/:id/respond`) → convert to project (`/quotes/:id/convert`) → deposit invoice auto-drafted.
- Client portal per project (`/api/projects/:id/portal`, `/api/public/portal/:token`) — token-based public access for change-order approval, selections, forms.
- Bidding: `/api/bid-packages`, bids, award, share; client jobs can receive bids (`/api/client/jobs/:id/bids/:id/award`).
- Money chain: commitments → claims → payment-applications (submit/approve/reject/mark-paid) → retention (release) → certificates → invoices.
- Site tours (`/api/projects/:id/tours`, share), selections (`/selections`, send), client-updates, client-messages/threads, drawing versions + viewer, BOQ revisions (import/apply-budget/restore).

## Notable product choices
- Everything hangs off **Project** as the aggregate root (~40 `/api/projects/:id/*` sub-resources).
- "New" global menu: Change order, Project, Daily log, Schedule activity, Ask the reference platform AI.
- AI is productised separately: "Buildflex Ai" module + "Ask the reference platform AI" + ai-credits billing (checkout/verify endpoints).
- Role manager: 14 roles, per-role module access (36) + 18 granular permissions + approval limit — fully customisable, changes apply immediately.
- "Viewing as" switcher lets the Contractor preview the workspace as another role sees it.
