import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

// Round A: a contractor must be able to type BoQ items by hand — not only
// import Excel. Item-level CRUD on the ACTIVE BOQ, totals kept in sync.

describe('A: manual BoQ item entry (type one, edit one, remove one)', () => {
  const server = buildServer();
  let adminCookie: string;
  let tenantId: string;
  let projectId: string;

  const auth = () => ({ cookie: adminCookie });

  beforeAll(async () => {
    await server.ready();
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = res.headers['set-cookie'] as string;
    tenantId = JSON.parse(res.body).user.tenant.id;
    const project = await withTenantTx(prisma, tenantId, (tx) =>
      tx.project.create({
        data: { tenant_id: tenantId, code: `BM-${Date.now().toString().slice(-6)}`, name: 'Manual BoQ Test Project', status: 'ACTIVE' },
      }),
    );
    projectId = project.id;
  });

  it('creates the ACTIVE BOQ on first item and returns the item with computed totals', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/items`,
      headers: auth(),
      payload: {
        itemCode: '1.1',
        description: 'Excavate foundation trenches 1.5m deep',
        unit: 'M3',
        quantity: 850,
        unitRate: 780,
      },
    });
    expect(res.statusCode).toBe(201);
    const { data: item } = JSON.parse(res.body);
    expect(item.description).toContain('Excavate foundation');
    expect(Number(item.quantity)).toBe(850);
    expect(Number(item.total_amount ?? item.totalAmount)).toBeCloseTo(663000, 0);
  });

  it('second item lands in the same BOQ and totals accumulate', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/items`,
      headers: auth(),
      payload: {
        itemCode: '1.2',
        description: 'Concrete blinding 50mm thick',
        unit: 'M3',
        quantity: 120,
        unitRate: 9500,
      },
    });
    expect(res.statusCode).toBe(201);

    const boqRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/boq`,
      headers: auth(),
    });
    expect(boqRes.statusCode).toBe(200);
    const boq = JSON.parse(boqRes.body).data;
    expect(Number(boq.total_amount)).toBeCloseTo(663000 + 1140000, 0);
    const allItems = boq.sections.flatMap((s: { items: unknown[] }) => s.items);
    expect(allItems).toHaveLength(2);
  });

  it('edits quantity/rate and recomputes totals', async () => {
    const list = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/boq/items`,
      headers: auth(),
    });
    const items = JSON.parse(list.body).data;
    const target = items.find((i: { description: string }) => i.description.includes('blinding'));
    expect(target).toBeTruthy();

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/boq/items/${target.id}`,
      headers: auth(),
      payload: { quantity: 100, unitRate: 9000 },
    });
    expect(res.statusCode).toBe(200);

    const boqRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/boq`,
      headers: auth(),
    });
    const boq = JSON.parse(boqRes.body).data;
    // 663000 + 100*9000 = 1,563,000
    expect(Number(boq.total_amount)).toBeCloseTo(1563000, 0);
  });

  it('deletes an item and recomputes totals', async () => {
    const list = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/boq/items`,
      headers: auth(),
    });
    const items = JSON.parse(list.body).data;
    const target = items.find((i: { description: string }) => i.description.includes('Excavate'));

    const res = await server.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${projectId}/boq/items/${target.id}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);

    const boqRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/boq`,
      headers: auth(),
    });
    const boq = JSON.parse(boqRes.body).data;
    expect(Number(boq.total_amount)).toBeCloseTo(900000, 0);
  });

  it('rejects invalid input with a plain message', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/items`,
      headers: auth(),
      payload: { itemCode: '9.9', description: '', unit: 'M3', quantity: -5, unitRate: 0 },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error ?? body.message).toBeTruthy();
  });

  it('honours an explicit section title', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/items`,
      headers: auth(),
      payload: {
        sectionTitle: 'Earthworks',
        itemCode: '2.1',
        description: 'Cut and fill to formation level',
        unit: 'M3',
        quantity: 500,
        unitRate: 320,
      },
    });
    expect(res.statusCode).toBe(201);
    const boqRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/boq`,
      headers: auth(),
    });
    const boq = JSON.parse(boqRes.body).data;
    const section = boq.sections.find((s: { title: string }) => s.title === 'Earthworks');
    expect(section).toBeTruthy();
    expect(section.items).toHaveLength(1);
  });
});
