import { randomUUID } from 'node:crypto';
import { APIRequestContext, expect } from '@playwright/test';

export const API = process.env.E2E_API_URL || 'http://localhost:4199';

export interface Session {
  cookie: string;
  user: any;
  tenantId: string;
}

/** Log in through the real auth endpoint; returns the session cookie header. */
export async function login(request: APIRequestContext, email: string, password = 'Password123!'): Promise<Session> {
  const res = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(res.status(), `login ${email}`).toBe(200);
  const body = await res.json();
  const setCookie = res.headers()['set-cookie'] || '';
  // Fastify may emit multiple Set-Cookie headers; Playwright joins them.
  const cookie = setCookie.split(/,(?=[^;]+=)/).map((c) => c.split(';')[0]).join('; ');
  return { cookie, user: body.user, tenantId: body.user.tenant.id };
}

export function authHeaders(session: Session): Record<string, string> {
  return { Cookie: session.cookie, 'Content-Type': 'application/json' };
}

/** Unwrap the common { data: ... } / { invoice: ... } response envelopes. */
export function unwrap(body: any): any {
  if (body && typeof body === 'object' && 'data' in body && body.data !== undefined) return body.data;
  return body;
}

export async function apiGet(request: APIRequestContext, session: Session, path: string) {
  return request.get(`${API}${path}`, { headers: authHeaders(session) });
}

export async function apiPost(request: APIRequestContext, session: Session, path: string, data?: any, extraHeaders: Record<string, string> = {}) {
  // Payment recording requires an Idempotency-Key (Stage-7). Specs that don't
  // set one get a fresh key per call — same semantics as before for them.
  const headers = { ...authHeaders(session), ...extraHeaders };
  if (path.includes('/payments') && !headers['idempotency-key'] && !headers['Idempotency-Key']) {
    headers['idempotency-key'] = randomUUID();
  }
  return request.post(`${API}${path}`, {
    headers,
    data,
  });
}

export async function apiPatch(request: APIRequestContext, session: Session, path: string, data?: any) {
  return request.patch(`${API}${path}`, { headers: authHeaders(session), data });
}

/** Pick the first project visible to a session. */
export async function firstProjectId(request: APIRequestContext, session: Session): Promise<string> {
  const res = await apiGet(request, session, '/api/v1/projects');
  expect(res.status()).toBe(200);
  const body = await res.json();
  const rows = Array.isArray(body) ? body : body.projects || body.data || [];
  expect(rows.length, 'seeded tenant must have at least one project').toBeGreaterThan(0);
  // Prefer the seeded demo project — it carries ProjectMember rows for every
  // seeded role; ad-hoc projects created by earlier runs may not.
  const seeded = rows.find((p: any) => /riverside/i.test(p.name || '')) || rows[0];
  return seeded.id;
}

/**
 * Clean demo names for e2e fixtures — visible names stay realistic
 * ("Kilimani Apartments"); uniqueness lives in codes/refs/emails.
 * Deterministic per salt so chromium/mobile runs pick varied names.
 */
const FIXTURE_NAME_POOLS = {
  project: ['Kilimani Apartments','Runda Residence','Lavington Court','Karen Bungalow','Westlands Plaza','Ruaka Townhouses','Kileleshwa Villas','Embakasi Warehouse','Kitisuru Gardens','Muthaiga Court','Gigiri Office Park','Rosslyn Ridge','Spring Valley Suites','LNhapta Heights','South B Estates','Ngong Road Plaza','Eldoret Showground','Kisumu Ports Avenue','Nyali Beach Villas','Diani Reef Resort','Thika Greens','Nakuru Milimani','Eldoret Elgon View','Kakamega Forest Edge','Malindi Marine Court','Nairobi Industrial Area','Syokimau Logistics Hub','Athi River Mills','Kitengela Acacia','Rongai Sunrise'],
  company: ['Meridian Build Ltd','Savannah Construction Ltd','Highland Developers Ltd','Coastline Builders Ltd','Rift Valley Contractors Ltd','Acacia Homes Ltd','Mara Delta Construction','Tsavo Bulk Builders','Aberdare Civil Works','Turkana Builders Co','Coastline Marine Contractors','Savannah Roofing & Steel','Nile Basin Construction','Kijani Developments','Wanjiku Contractors','Pembe Homes Ltd','Sauti Build Group','Baraka Construction Co'],
  supplier: ['East Africa Cement Suppliers','Savannah Timber & Boards','Nyali Steel & Roofing','Mombasa Hardware & Paints','Nakuru Aggregate Supplies','Tatu City Concrete Works','Ruiru Sand & Ballast','Kahawa Plumbing Supplies','Kitui Stone Cutters','Malindi Paint Depot','Eldoret Welding Supplies','Thika Agro Chemicals','Karen Glass & Glazing','Ngong Timber Yard','Rongai Brickworks','Kitengela Quarry Supplies','Syokimau Packaging Ltd','Athi River Steel Traders','Kasarani Electrical Depot','Ruai Building Materials','Kitui Hardware','Nakuru Paint & Plumbing','Eldoret Timber & Boards','Malindi Cement Agencies'],
  subcontractor: ['FlowFit Mechanical Services','Kijani Electrical Contractors','PaveRight Asphalt Ltd','AquaLine Plumbing Services','SafeSite Scaffolding Ltd','BuildRight Masonry Ltd','CoolBreeze HVAC Services','BrightSpark Electricals','SolidGround Foundations','TrueLine Glazing','PeakForm Roofing','DrainRight Plumbing','WireWorks Electrical','StoneCraft Masonry','LiftPro Elevator Services','SolarBright Installations','FenceRight Boundary','CleanSite Facility Services','Precision Painters Ltd','Anchor Bolt Fixings','Metro Lifts & Escalators','EcoTherm Insulation','RapidDry Waterproofing','Tusk Gate Automation'],
  client: ['Nyambane Properties','Tatu City Logistics','Delta Freight Ltd','Savannah Holdings','Highland Property Group','Kileleshwa Estates','Delta Retail Malls','Nakuru Agro-processors','Mombasa Port Services','Rift Energy Ltd','Savannah Safari Lodges','Nyeri Tea Producers','Coast Packaging Industries','Great Rift University','Lake Basin Fisheries','Highlands Fresh Produce','Turkwel Dam Contractors','Sagana Floriculture','Ol Pejeta Conservancy','Maasai Mara Tours'],
  quote: ['Family Home Extension','Office Fit-Out Phase 1','Warehouse Expansion','School Block Renovation','Apartment Block Fit-Out','Retail Unit Refurbishment','Hospital Wing Upgrade','Hotel Lobby Refurbishment','Factory Mezzanine Floor','Church Hall Extension','Clinic Reception Block','Library Reading Room','Showroom Fit-Out','Cold Room Installation','Staff Apartments Block','Boundary Wall & Gates','Water Tank Installation','Solar Array Mounting','Borehole & Pump House','CCTV & Access Control'],
  invoice: ['Progress claim — superstructure','Final account — external works','Variation account — additional piling','Stage payment — façade works','Interim valuation — ground floor','Progress claim — first fix services','Stage payment — external works','Variation account — client changes','Interim valuation — finishes','Progress claim — second fix','Retention release — phase 1','Materials on site — month 1','Daywork account — week 3','Provisional sum — prime cost','Nominated subcontractor account','Advance payment — mobilisation','Final account — nominated works','Variation account — provisional sums','Stage payment — services complete','Interim valuation — envelope'],
  variation: ['Additional piling to bedrock','Client-added ensuite bathrooms','Upgraded roof insulation','Extended stormwater drainage','Additional parking bays','Relocated service core','Upgraded floor finishes','Additional landscaping','Revised window schedule','Extra standby generator','Deepened basement excavation','Additional perimeter fencing','Upgraded BMS controls','Extra lift car','Reconfigured lobby layout','Additional EV charging points','Extended site hoarding','Upgraded external lighting','Additional water storage','Relocated entrance canopy'],
  changeorder: ['Client-requested stone cladding','Additional canopy over main entrance','Upgraded flooring specification','Extra security lighting','Repositioned reception desk','Additional signage package','Upgraded kitchen equipment','Extended patio decking','Additional built-in storage','Relocated plant room','Upgraded bathroom fixtures','Extra external benches','Revised ceiling design','Additional feature wall','Upgraded door hardware','Extended guttering runs','Additional sensor lighting','Revised paving pattern','Extra wall insulation','Relocated electrical db'],
  rfi: ['Clarification on foundation depth','Roof pitch dimension query','Door schedule discrepancy','Grid line confirmation','Ceiling void depth query','Drainage invert levels','Lintel sizing confirmation','Waterproofing detail query','Expansion joint spacing','Fire rating confirmation','Ceiling grid alignment','Anchor bolt positions','Parapet coping detail','Balustrade height query','Acoustic ceiling spec','Ventilation opening size','Plaster finish standard','Paint system confirmation','Floor tolerance query','Sealant specification'],
  package: ['Plumbing first-fix package','Electrical first-fix package','Waterproofing package','Drylining & partitions','Floor screed package','External rendering','Roof covering package','Joinery package','Metalwork package','Landscaping package','External works package','Fire protection package','HVAC package','Lift installation package','BMS package','External signage package','Kitchen fit-out package','Solar installation package','Borehole package','Boundary fencing package'],
  generic: ['River sand (plaster grade)','Ballast 20mm','Y12 reinforcement bar','Cement 50kg (Bamburi)','Plywood shuttering 18mm','Hardwood props 100x100','Murram fill (compacted)','DPC membrane 30m roll','Binding wire 16G','Nails 75mm box','PVC pipes 110mm class D','Roofing nails 50mm','Wire mesh 4.0mm','Bitumen paint 20L','Emulsion paint 20L white','Gravel 10mm decorative','Boulders 150-300mm','Laterite blocks 6-inch','Clay bricks class A','Steel reinforcing mesh'],
} as const;
export type FixtureKind = keyof typeof FIXTURE_NAME_POOLS;
export function fixtureName(kind: FixtureKind, salt: string | number): string {
  const pool = FIXTURE_NAME_POOLS[kind];
  const s = String(salt);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return pool[(h >>> 0) % pool.length]!;
}

/**
 * The console project picker renders as a <select> on sm+ screens and a
 * button+listbox dropdown on phones — exactly one is visible per viewport.
 * These helpers always drive whichever is visible.
 */
export function activeProjectPicker(page: import('@playwright/test').Page) {
  return page.locator('[aria-label="Active project"]:visible');
}

export async function selectActiveProject(page: import('@playwright/test').Page, name: string): Promise<void> {
  // Wait for whichever picker variant this viewport renders — a one-shot
  // isVisible check can race the header hydration and hit the hidden one.
  await expect(page.locator('[aria-label="Active project"]:visible').first()).toBeVisible({ timeout: 20_000 });
  const sel = page.locator('select[aria-label="Active project"]');
  if (await sel.isVisible().catch(() => false)) {
    const opt = sel.locator('option', { hasText: name });
    const val = await opt.getAttribute('value');
    expect(val, `project option "${name}"`).toBeTruthy();
    await sel.selectOption(val!);
    return;
  }
  const btn = page.locator('button[aria-label="Active project"]');
  await expect(btn).toBeVisible({ timeout: 20_000 });
  if ((await btn.innerText()).includes(name)) return; // already active
  await btn.click();
  await page.getByLabel('Choose project').getByRole('option', { name: new RegExp(name) }).click();
}
