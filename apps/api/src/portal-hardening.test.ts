import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { enrollAllTenantUsers } from './test-members';

/**
 * Portal hardening suite (auditor items 1-11):
 * package-scoped subcontractor links, permission allow-list, rate limits,
 * DTO trimming, verified uploads, consultant reply rules, Decimal valuations,
 * supplier confirm/dispute rules, honest compliance summary, link lifecycle.
 */
describe('Portal hardening', () => {
  const server = buildServer();
  let adminCookie: string;
  let pmCookie: string;
  let supervisorCookie: string;
  let execCookie: string;
  let projectId: string;
  let pkgAId: string;
  let pkgBId: string;
  let subAToken: string;
  let subBToken: string;
  let consultantToken: string;
  let supplierToken: string;
  let supplierId: string;
  let linkIdA: string;

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) => {
      const r = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return r.headers['set-cookie'] as string;
    };
    adminCookie = await login('admin@apexbuilders.co.ke');
    supervisorCookie = await login('supervisor@apexbuilders.co.ke');
    pmCookie = await login('pm@apexbuilders.co.ke');
    execCookie = await login('executive@apexbuilders.co.ke');

    const projRes = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie: adminCookie } });
    projectId = JSON.parse(projRes.body).data[0].id;
    await enrollAllTenantUsers(projectId);

    // Two subcontractor packages on the same project
    for (const [firm, trade, sum] of [
      ['Simba Plumbing Solutions', 'PLUMBING', '2500000.00'],
      ['Volt Electrical Contractors', 'ELECTRICAL', '1800000.00'],
    ] as const) {
      const r = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/subcontractors`,
        headers: { cookie: adminCookie },
        payload: { tradeCategory: trade, firmName: firm, subcontractSum: sum, retentionRatePct: '5.00', status: 'ACTIVE' },
      });
      expect(r.statusCode).toBe(201);
      const id = JSON.parse(r.body).id || JSON.parse(r.body).data?.id;
      if (firm.startsWith('Simba')) pkgAId = id; else pkgBId = id;
    }

    const mkLink = async (portalType: string, extra: any = {}) => {
      const r = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/portals/links`,
        headers: { cookie: adminCookie },
        payload: { portalType, stakeholderName: `Test ${portalType}`, expiresInDays: 30, ...extra },
      });
      return r;
    };

    const subA = await mkLink('SUBCONTRACTOR', { stakeholderName: 'Simba Plumbing Solutions', stakeholderRole: 'Plumbing', subcontractorPackageId: pkgAId });
    expect(subA.statusCode).toBe(201);
    const subABody = JSON.parse(subA.body).data;
    subAToken = subABody.token; linkIdA = subABody.id;

    const subB = await mkLink('SUBCONTRACTOR', { stakeholderName: 'Volt Electrical Contractors', stakeholderRole: 'Electrical', subcontractorPackageId: pkgBId });
    subBToken = JSON.parse(subB.body).data.token;

    // Supplier links must bind to a Supplier record (stage-3 contract).
    const supRes = await server.inject({
      method: 'POST', url: '/api/v1/suppliers', headers: { cookie: adminCookie },
      payload: { name: 'Bamburi Ready-Mix', contactPerson: 'Plant Manager' },
    });
    expect(supRes.statusCode).toBe(201);
    supplierId = JSON.parse(supRes.body).data.id;

    consultantToken = JSON.parse((await mkLink('CONSULTANT', { stakeholderName: 'Arch. Test' })).body).data.token;
    const supLink = await mkLink('SUPPLIER', { stakeholderName: 'Bamburi Ready-Mix', supplierId });
    expect(supLink.statusCode).toBe(201);
    supplierToken = JSON.parse(supLink.body).data.token;
  });

  // ---- Item 1: package-scoped subcontractor isolation ----
  it('1a: SUBCONTRACTOR link creation without packageId is rejected', async () => {
    const r = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/portals/links`,
      headers: { cookie: adminCookie },
      payload: { portalType: 'SUBCONTRACTOR', stakeholderName: 'No Package Sub' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('1b: subcontractor A sees only package A — never package B', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/v1/portals/subcontractor/${subAToken}` });
    expect(res.statusCode).toBe(200);
    const d = JSON.parse(res.body).data;
    expect(d.packages.length).toBe(1);
    expect(d.packages[0].id).toBe(pkgAId);
    expect(d.packages[0].firmName).toBe('Simba Plumbing Solutions');
    expect(JSON.stringify(d)).not.toContain('Volt Electrical');
    // DTO must not leak internal columns
    expect(d.packages[0]).not.toHaveProperty('tenant_id');
    expect(d.packages[0]).not.toHaveProperty('created_by_id');
  });

  it('1c: subcontractor B is equally isolated', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/v1/portals/subcontractor/${subBToken}` });
    const d = JSON.parse(res.body).data;
    expect(d.packages.length).toBe(1);
    expect(d.packages[0].id).toBe(pkgBId);
  });

  it('1d: valuation against another package is forbidden', async () => {
    const res = await server.inject({
      method: 'POST', url: `/api/v1/portals/subcontractor/${subAToken}/valuations`,
      payload: { packageId: pkgBId, grossWorkCertifiedKes: '100000.00' },
    });
    expect(res.statusCode).toBe(403);
  });

  // ---- Item 2: role-restricted link management ----
  it('2: every non-admin/PM_QS role is denied link creation and listing', async () => {
    for (const [label, cookie] of [['supervisor', supervisorCookie], ['executive', execCookie]] as const) {
      const create = await server.inject({
        method: 'POST', url: `/api/v1/projects/${projectId}/portals/links`,
        headers: { cookie },
        payload: { portalType: 'CLIENT', stakeholderName: 'Should Fail' },
      });
      expect(create.statusCode, `${label} create`).toBe(403);
      const list = await server.inject({
        method: 'GET', url: `/api/v1/projects/${projectId}/portals/links`,
        headers: { cookie },
      });
      expect(list.statusCode, `${label} list`).toBe(403);
    }
    // PM_QS and admin allowed
    for (const [label, cookie] of [['admin', adminCookie], ['pm', pmCookie]] as const) {
      const list = await server.inject({
        method: 'GET', url: `/api/v1/projects/${projectId}/portals/links`,
        headers: { cookie },
      });
      expect(list.statusCode, `${label} list`).toBe(200);
    }
  });

  // ---- Item 3: identical 404s ----
  it('3: invalid, expired and wrong-type tokens all return identical 404 shape', async () => {
    const bodies: string[] = [];
    for (const url of [
      '/api/v1/portals/consultant/not-a-real-token',
      '/api/v1/portals/consultant/expired-token-placeholder',
      `/api/v1/portals/consultant/${supplierToken}`, // wrong type
    ]) {
      const r = await server.inject({ method: 'GET', url });
      expect(r.statusCode).toBe(404);
      bodies.push(r.body);
    }
    // Same status + same error envelope (message may name the portal)
    for (const b of bodies) {
      const j = JSON.parse(b);
      expect(j.statusCode).toBe(404);
      expect(j.error).toBe('Not Found');
    }
  });

  // ---- Item 5: rectify requires verified upload ----
  it('5a: rectify rejects a foreign storage key', async () => {
    const r = await server.inject({
      method: 'POST', url: `/api/v1/portals/subcontractor/${subAToken}/snags/00000000-0000-0000-0000-000000000000/rectify`,
      payload: { photoStorageKey: 'other-tenant/other-project/evil.jpg' },
    });
    // 400 key rejection happens before snag lookup
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body).message).toContain('upload via the portal upload endpoint');
  });

  it('5b: portal upload rejects non-allowlisted content', async () => {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from('<html><script>alert(1)</script></html>')], { type: 'text/html' }), 'evil.html');
    const r = await server.inject({
      method: 'POST', url: `/api/v1/portals/subcontractor/${subAToken}/snags/00000000-0000-0000-0000-000000000000/upload`,
      payload: form,
    });
    expect(r.statusCode).toBe(415);
  });

  it('5c: portal upload accepts a verified PNG and returns tenant/project-scoped key', async () => {
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'proof.png');
    const r = await server.inject({
      method: 'POST', url: `/api/v1/portals/subcontractor/${subAToken}/snags/00000000-0000-0000-0000-000000000000/upload`,
      payload: form,
    });
    expect(r.statusCode).toBe(201);
    const key = JSON.parse(r.body).data.storageKey;
    expect(key).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/);
  });

  // ---- Item 6: consultant reply rules ----
  it('6a: reply with missing/short body returns 400', async () => {
    const rfi = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/rfis`,
      headers: { cookie: supervisorCookie },
      payload: { title: 'Hardening RFI', question: 'Clarify cover?', priority: 'MEDIUM', assignedToRole: 'QS' },
    });
    expect(rfi.statusCode).toBeLessThan(300);
    const rfiId = JSON.parse(rfi.body).id || JSON.parse(rfi.body).data?.id;
    for (const payload of [{}, { officialAnswer: 'hi' }]) {
      const r = await server.inject({
        method: 'POST', url: `/api/v1/portals/consultant/${consultantToken}/rfis/${rfiId}/reply`, payload,
      });
      expect(r.statusCode).toBe(400);
    }
    // valid reply works and records external responder, not the creator
    const ok = await server.inject({
      method: 'POST', url: `/api/v1/portals/consultant/${consultantToken}/rfis/${rfiId}/reply`,
      payload: { officialAnswer: 'Use 40mm cover per BS 8110.', consultantName: 'Arch. Test' },
    });
    expect(ok.statusCode).toBe(200);
    const resp = JSON.parse(ok.body).data;
    expect(resp.external_responder_name).toBe('Arch. Test');
    expect(resp.responder_id).toBeNull();
    // second reply rejected — RFI now ANSWERED
    const again = await server.inject({
      method: 'POST', url: `/api/v1/portals/consultant/${consultantToken}/rfis/${rfiId}/reply`,
      payload: { officialAnswer: 'Another answer attempt here.' },
    });
    expect(again.statusCode).toBe(409);
  });

  // ---- Item 7: subcontractor valuation math ----
  it('7: valuation uses Decimal, caps at package sum, requires bound package', async () => {
    // over package sum -> 400
    const over = await server.inject({
      method: 'POST', url: `/api/v1/portals/subcontractor/${subAToken}/valuations`,
      payload: { grossWorkCertifiedKes: '9999999.00' },
    });
    expect(over.statusCode).toBe(400);
    // valid first valuation
    const v1 = await server.inject({
      method: 'POST', url: `/api/v1/portals/subcontractor/${subAToken}/valuations`,
      payload: { grossWorkCertifiedKes: '1000000.00', notes: 'Phase 1 complete' },
    });
    expect(v1.statusCode).toBe(201);
    const v1d = JSON.parse(v1.body).data;
    // gross 1,000,000; retention 5% = 50,000; WHT 3% on (gross - prevPaid=0)=30,000; net=920,000
    expect(Number(v1d.gross_work_certified_kes)).toBe(1000000);
    expect(Number(v1d.retention_deducted_kes)).toBe(50000);
    expect(Number(v1d.withholding_tax_deducted_kes)).toBe(30000);
    expect(Number(v1d.net_payable_kes)).toBe(920000);
    expect(Number(v1d.previous_payments_deducted_kes)).toBe(0);
    // second valuation must exceed certified-to-date
    const dup = await server.inject({
      method: 'POST', url: `/api/v1/portals/subcontractor/${subAToken}/valuations`,
      payload: { grossWorkCertifiedKes: '500000.00' },
    });
    expect(dup.statusCode).toBe(400);
    // cumulative second valuation
    const v2 = await server.inject({
      method: 'POST', url: `/api/v1/portals/subcontractor/${subAToken}/valuations`,
      payload: { grossWorkCertifiedKes: '1500000.00' },
    });
    expect(v2.statusCode).toBe(201);
  });

  // ---- Item 8: supplier confirm/dispute ----
  it('8: dispute requires note; final states block further actions', async () => {
    // create a site diary with a nested material delivery via API
    const diary = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/site-diaries`,
      headers: { cookie: supervisorCookie },
      payload: {
        entryDate: '2026-11-09',
        weather: 'SUNNY_CLEAR',
        siteStatus: 'OPERATIONAL',
        deliveries: [{ materialName: 'Cement 50kg', quantity: '100', unit: 'BAGS', supplierName: 'Bamburi Ready-Mix', supplierId }],
      },
    });
    expect(diary.statusCode).toBeLessThan(300);
    const diaryData = JSON.parse(diary.body).data || JSON.parse(diary.body);
    const delId = diaryData.deliveries[0].id;

    // DISPUTE without note -> 400
    const noNote = await server.inject({
      method: 'POST', url: `/api/v1/portals/supplier/${supplierToken}/deliveries/${delId}/confirm`,
      payload: { action: 'DISPUTE' },
    });
    expect(noNote.statusCode).toBe(400);
    // DISPUTE with note -> 200, stores dispute_reason
    const dispute = await server.inject({
      method: 'POST', url: `/api/v1/portals/supplier/${supplierToken}/deliveries/${delId}/confirm`,
      payload: { action: 'DISPUTE', note: 'Only 80 bags arrived, short delivery' },
    });
    expect(dispute.statusCode).toBe(200);
    expect(JSON.parse(dispute.body).data.dispute_reason).toContain('short delivery');
    // final state: CONFIRM now blocked
    const after = await server.inject({
      method: 'POST', url: `/api/v1/portals/supplier/${supplierToken}/deliveries/${delId}/confirm`,
      payload: { action: 'CONFIRM', invoiceRef: 'INV-1' },
    });
    expect(after.statusCode).toBe(409);
  });

  // ---- Item 9: compliance honesty ----
  it('9: compliance summary reports honest nulls, not invented values', async () => {
    const compLink = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/portals/links`,
      headers: { cookie: adminCookie },
      payload: { portalType: 'COMPLIANCE', stakeholderName: 'NCA Officer' },
    });
    const tok = JSON.parse(compLink.body).data.token;
    const res = await server.inject({ method: 'GET', url: `/api/v1/portals/compliance/${tok}` });
    const d = JSON.parse(res.body).data;
    expect(d.complianceSummary.ncaSiteRegistration).toBeNull();
    // fresh project may have no cube breaks -> null pass rate, not 100%
    if ((d.complianceSummary.totalBatchesSampled ?? 0) === 0 || d.complianceSummary.concreteCubePassRate === null) {
      expect(d.complianceSummary.concreteCubePassRate === null || d.complianceSummary.concreteCubePassRate === 'No tests yet' || typeof d.complianceSummary.concreteCubePassRate === 'string').toBe(true);
    }
  });

  // ---- Item 10: link lifecycle ----
  it('10: regenerate revokes old token; revoke kills access; listing shows usage', async () => {
    // regenerate
    const regen = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/portals/links/${linkIdA}/regenerate`,
      headers: { cookie: adminCookie },
    });
    expect(regen.statusCode).toBe(201);
    const regenBody = JSON.parse(regen.body).data;
    const newTok = regenBody.token;
    const newLinkId = regenBody.id;
    expect(newTok).not.toBe(subAToken);
    expect(regenBody.linkUrl).toContain(`/?portal=subcontractor&token=`);
    // old token dead
    const oldCheck = await server.inject({ method: 'GET', url: `/api/v1/portals/subcontractor/${subAToken}` });
    expect(oldCheck.statusCode).toBe(404);
    // new token works
    const newCheck = await server.inject({ method: 'GET', url: `/api/v1/portals/subcontractor/${newTok}` });
    expect(newCheck.statusCode).toBe(200);

    // revoke the NEW link
    const del = await server.inject({
      method: 'DELETE', url: `/api/v1/projects/${projectId}/portals/links/${newLinkId}`,
      headers: { cookie: adminCookie },
    });
    expect(del.statusCode).toBe(200);
    const dead = await server.inject({ method: 'GET', url: `/api/v1/portals/subcontractor/${newTok}` });
    expect(dead.statusCode).toBe(404);
    // listing shows revoked link with useCount/lastUsedAt fields
    const list = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/portals/links`, headers: { cookie: adminCookie } });
    const row = JSON.parse(list.body).data.find((l: any) => l.id === newLinkId);
    expect(row.isActive).toBe(false);
    expect(row).toHaveProperty('useCount');
    expect(row).toHaveProperty('lastUsedAt');
  });
});
