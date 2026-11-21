# Visual evidence — commit 0bf3592 (G2)

Command: `cd e2e && node capture-visual.mjs` (Playwright chromium, against
local API :4199 + vite :5180).

**Seed:** dedicated tenant `Nyota Construction Ltd`
(admin@nyota-builders.co.ke), project `Kileleshwa Residential Villas`
(KIL-RES-01), provisioned by the capture script itself via
`/api/v1/auth/register-company` + `/api/v1/invitations` + one project +
one subcontractor package + one SENT invoice + five portal links.
The API test suite never touches this tenant — no fixture rows such as
`SENT-VISIBLE-*` or ad-hoc certificate numbers can appear. See `SEED.txt`.

Output: 20 PNGs — 5 portals (consultant, subcontractor, supplier,
compliance, client) + 5 console roles (admin/COMPANY_ADMIN, PM_QS,
SITE_SUPERVISOR, CLIENT, VIEWER) × 2 viewports (390×844, 1440×900).

390px changes verified in these shots:
- Header search is a proper icon button ("Open search") that expands the
  real input; Escape or picking a result collapses it back to the icon.
- Client portal "← Back to Dashboard" is a bordered button, matching the
  other four portals' "← Back to Project" buttons.
- Console Money rail icon carries the review badge only while held
  provider payments await resolution (G1).
