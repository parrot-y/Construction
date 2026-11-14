# Visual evidence — commit 90ba399

Command: `cd e2e && node capture-visual.mjs` (Playwright chromium, against
local API :4199 + vite :5180 on the seeded demo tenant).

Output: 20 PNGs — 5 portals (consultant, subcontractor, supplier,
compliance, client) + 5 console roles (admin, pm-qs, site supervisor,
client, viewer) × 2 viewports (390×844, 1440×900).

390px overflow check (same run, programmatic):
`document.documentElement.scrollWidth == 390` on all 5 console roles and
the compliance portal after fixes in 90ba399 (header min-w-0, client nav
overflow-x-auto, portal container w-full).

Stale 2026-11-09 images at docs/evidence/visual/*.png deleted.
