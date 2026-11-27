import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

// CB4 — GRN/PO register (Assistant QS competitive gap): a dedicated
// tenant-level register joining purchase orders and material deliveries
// (GRNs) with supplier + store + value columns.
describe('CB4 — purchase register', () => {
  const server = buildServer();

  let adminCookie: string;
  let projectId: string;
  let supplierId: string;
  let poId: string;
  const storeName = `CB4 Store ${Date.now().toString().slice(-5)}`;

  const authed = () => ({ cookie: adminCookie });

  beforeAll(async () => {
    await server.ready();
    const login = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    adminCookie = login.headers['set-cookie'] as string;

    const proj = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: authed(),
      payload: {
        name: 'CB4 Register Site',
        code: `CB4-${Date.now().toString().slice(-4)}`,
        location: 'Kilimani, Nairobi',
        originalContractSum: 60000000,
      },
    });
    expect(proj.statusCode).toBe(201);
    projectId = JSON.parse(proj.body).data.id;

    const sup = await server.inject({
      method: 'POST',
      url: '/api/v1/suppliers',
      headers: authed(),
      payload: { name: `CB4 Hardware ${Date.now().toString().slice(-5)}`, phone: '+254700000001' },
    });
    expect(sup.statusCode).toBe(201);
    supplierId = JSON.parse(sup.body).data?.id ?? JSON.parse(sup.body).supplier?.id ?? JSON.parse(sup.body).id;
  });

  it('PO create accepts storeLocation and appears in the register with value', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/purchase-orders`,
      headers: authed(),
      payload: {
        supplierId,
        storeLocation: storeName,
        items: [
          { description: 'Cement 50kg', unit: 'bag', quantity: 100, rate: 780 },
          { description: 'Ballast 20mm', unit: 'm3', quantity: 10, rate: 2800 },
        ],
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    const po = JSON.parse(res.body).data ?? JSON.parse(res.body).purchaseOrder ?? JSON.parse(res.body);
    poId = po.id;
    expect(po.storeLocation ?? po.store_location).toBe(storeName);

    const reg = await server.inject({
      method: 'GET',
      url: `/api/v1/purchase-register?projectId=${projectId}&kind=PO`,
      headers: authed(),
    });
    expect(reg.statusCode, reg.body).toBe(200);
    const rows = JSON.parse(reg.body).rows ?? JSON.parse(reg.body).data ?? [];
    const mine = rows.find((r: any) => r.ref === po.poNumber || r.id === poId);
    expect(mine, 'PO row in register').toBeTruthy();
    expect(mine.kind).toBe('PO');
    expect(mine.supplierName ?? mine.supplier).toBeTruthy();
    expect(mine.storeLocation ?? mine.store_location ?? mine.store).toBe(storeName);
    expect(Number(mine.value ?? mine.totalValue ?? mine.total_amount_kes ?? mine.totalAmount)).toBeCloseTo(106000, 0);
  });

  it('diary delivery with storeLocation appears as a GRN row with computed value', async () => {
    const diary = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/site-diaries`,
      headers: authed(),
      payload: {
        projectId,
        entryDate: new Date().toISOString().slice(0, 10),
        weather: 'SUNNY_CLEAR',
        siteStatus: 'OPERATIONAL',
        deliveries: [
          {
            materialName: 'Cement 50kg',
            quantity: '50',
            unit: 'bag',
            supplierId,
            storeLocation: storeName,
            purchaseOrderId: poId,
          },
        ],
      },
    });
    expect(diary.statusCode, diary.body).toBeLessThan(300);

    const reg = await server.inject({
      method: 'GET',
      url: `/api/v1/purchase-register?projectId=${projectId}&kind=GRN`,
      headers: authed(),
    });
    expect(reg.statusCode, reg.body).toBe(200);
    const rows = JSON.parse(reg.body).rows ?? JSON.parse(reg.body).data ?? [];
    const grn = rows.find((r: any) => /cement/i.test(r.description ?? r.materialName ?? ''));
    expect(grn, 'GRN row in register').toBeTruthy();
    expect(grn.kind).toBe('GRN');
    expect(grn.storeLocation ?? grn.store_location ?? grn.store).toBe(storeName);
    // 50 bags × 780 = 39,000 via the linked PO item rate.
    expect(Number(grn.value)).toBeCloseTo(39000, 0);
  });

  it('filters by store and supplier; unauthenticated access rejected', async () => {
    const byStore = await server.inject({
      method: 'GET',
      url: `/api/v1/purchase-register?store=${encodeURIComponent(storeName)}`,
      headers: authed(),
    });
    expect(byStore.statusCode).toBe(200);
    const rows = JSON.parse(byStore.body).rows ?? JSON.parse(byStore.body).data ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const r of rows) {
      expect(r.storeLocation ?? r.store_location ?? r.store).toBe(storeName);
    }

    const anon = await server.inject({ method: 'GET', url: '/api/v1/purchase-register' });
    expect(anon.statusCode).toBe(401);
  });
});
