# Visual evidence — commit bbdd2b2

Command: `cd e2e && node capture-visual.mjs` (Playwright chromium, against
local API :4199 + vite :5180 on the seeded demo tenant).

Output: 20 PNGs — 5 portals (consultant, subcontractor, supplier,
compliance, client) + 5 console roles (admin, pm-qs, site supervisor,
client, viewer) × 2 viewports (390×844, 1440×900).

Clean-data notes (F4):
- Project selected by name: "Riverside Commercial Plaza" (seeded demo) —
  throwaway spec fixtures never appear.
- Portal stakeholder names are realistic per type (e.g. "Eng. Wanjiru
  Kamau — Lead Consultant", "Riverside Property Holdings"), not
  "Visual Evidence <TYPE>".
- console-supervisor-* now shows the field home "Today's work" panel
  (diary / headcount / snags / safety incident) above the team inbox.

390px: header search remains a usable input (flex-1 min-w-0, verified
scrollWidth == 390 on all console roles in the 90ba399 run; layout
unchanged since).
