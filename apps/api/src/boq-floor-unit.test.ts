import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

// CB6 — BOQ floor/unit mapping (Assistant QS "Create Floor / Unit Mapping"
// takeoff dimension): BOQ items carry a floor and a unit reference so
// quantities can be tracked per storey / apartment. Items can be mapped
// individually or in bulk.
describe('CB6 — BOQ floor/unit takeoff mapping', () => {
  const server = buildServer();

  let adminCookie: string;
  let projectId: string;

  const authed = () => ({ cookie: adminCookie });

  const addItem = async (overrides: Record<string, any> = {}) => {
    return server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/items`,
      headers: authed(),
      payload: {
        description: 'Concrete blinding 50mm',
        unit: 'm3',
        quantity: 12,
        unitRate: 8500,
        ...overrides,
      },
    });
  };

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
        name: 'CB6 Takeoff Tower',
        code: `CB6-${Date.now().toString().slice(-4)}`,
        location: 'Upper Hill, Nairobi',
        originalContractSum: 80000000,
      },
    });
    expect(proj.statusCode).toBe(201);
    const projBody = JSON.parse(proj.body);
    projectId = projBody.data?.id ?? projBody.project?.id ?? projBody.id;
    expect(projectId).toBeTruthy();
  });

  it('accepts floor/unitRef on create and patch, and filters by them', async () => {
    const res = await addItem({ floor: 'Ground', unitRef: 'Retail podium', description: 'Blinding slab podium' });
    expect(res.statusCode, res.body).toBe(201);
    const created = JSON.parse(res.body).data;
    expect(created.floor).toBe('Ground');
    expect(created.unitRef ?? created.unit_ref).toBe('Retail podium');

    const res2 = await addItem({ description: 'First floor screed', floor: 'First', unitRef: 'A1' });
    expect(res2.statusCode, res2.body).toBe(201);
    const item2 = JSON.parse(res2.body).data;

    // PATCH remaps the item.
    const patch = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/boq/items/${item2.id}`,
      headers: authed(),
      payload: { floor: 'Second', unitRef: 'A1' },
    });
    expect(patch.statusCode, patch.body).toBe(200);
    const patched = JSON.parse(patch.body).data;
    expect(patched.floor).toBe('Second');

    // GET items?floor=Second returns only the remapped item.
    const list = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/boq/items?floor=Second`,
      headers: authed(),
    });
    expect(list.statusCode).toBe(200);
    const rows = JSON.parse(list.body).data ?? [];
    const mine = rows.filter((r: any) => r.id === item2.id || r.id === created.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].id).toBe(item2.id);
    expect(mine[0].floor).toBe('Second');
  });

  it('bulk-maps many items to a floor/unit in one call', async () => {
    // Three more unmapped items.
    const ids: string[] = [];
    for (const desc of ['Roof screed', 'Parapet wall', 'Waterproofing']) {
      const r = await addItem({ description: desc });
      expect(r.statusCode, r.body).toBe(201);
      ids.push(JSON.parse(r.body).data.id);
    }

    const bulk = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/items/bulk-map`,
      headers: authed(),
      payload: {
        mappings: ids.map((id) => ({ itemId: id, floor: 'Roof', unitRef: 'Common' })),
      },
    });
    expect(bulk.statusCode, bulk.body).toBe(200);

    const list = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/boq/items?floor=Roof&unitRef=Common`,
      headers: authed(),
    });
    const rows = JSON.parse(list.body).data ?? [];
    const found = rows.filter((r: any) => ids.includes(r.id));
    expect(found).toHaveLength(3);
    for (const r of found) {
      expect(r.floor).toBe('Roof');
      expect(r.unitRef ?? r.unit_ref).toBe('Common');
    }
  });

  it('clears mapping with null and validates bulk payloads', async () => {
    const create = await addItem({ description: 'Temporary item', floor: 'Basement' });
    const item = JSON.parse(create.body).data;

    const clear = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/boq/items/${item.id}`,
      headers: authed(),
      payload: { floor: null, unitRef: null },
    });
    expect(clear.statusCode, clear.body).toBe(200);
    const cleared = JSON.parse(clear.body).data;
    expect(cleared.floor).toBeNull();

    const badBulk = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/items/bulk-map`,
      headers: authed(),
      payload: { mappings: [{ itemId: 'not-a-uuid', floor: 'X' }] },
    });
    expect(badBulk.statusCode).toBe(400);

    const badItem = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/items`,
      headers: authed(),
      payload: { description: 'Bad floor item', unit: 'm', quantity: 1, unitRate: 1, floor: 42 },
    });
    expect(badItem.statusCode).toBe(400);
  });
});
