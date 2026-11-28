import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

// CB2 — rate master (Assistant QS competitive gap): a shared per-tenant
// rate library keyed by geography + item/material typing, with bulk
// upload/edit and a ranked lookup used to prefill BoQ lines and PO rates.
describe('CB2 — rate master', () => {
  const server = buildServer();

  let adminCookie: string;
  let entryId: string;

  const authed = () => ({ cookie: adminCookie });

  const baseEntry = {
    country: 'Kenya',
    stateRegion: 'Nairobi',
    city: 'Nairobi',
    itemType: 'MATERIAL',
    materialType: 'Cement',
    materialSubType: 'OPC 42.5N',
    description: 'Ordinary Portland Cement 50kg',
    unit: 'bag',
    unitRateKes: '780',
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
  });

  it('creates a rate-master entry and lists it with filters', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/rate-master',
      headers: authed(),
      payload: baseEntry,
    });
    expect(res.statusCode, res.body).toBe(201);
    const body = JSON.parse(res.body);
    entryId = body.entry?.id ?? body.data?.id ?? body.id;
    expect(entryId).toBeTruthy();

    const list = await server.inject({
      method: 'GET',
      url: '/api/v1/rate-master?materialType=Cement&city=Nairobi',
      headers: authed(),
    });
    expect(list.statusCode).toBe(200);
    const rows = JSON.parse(list.body).entries ?? JSON.parse(list.body).data ?? [];
    const mine = rows.find((r: any) => r.id === entryId);
    expect(mine, 'created entry in filtered list').toBeTruthy();
    expect(mine.unitRateKes).toBe('780');
    expect(mine.materialSubType).toBe('OPC 42.5N');
  });

  it('bulk upload upserts by natural key — repeat import updates, not duplicates', async () => {
    const bulk = await server.inject({
      method: 'POST',
      url: '/api/v1/rate-master/bulk',
      headers: authed(),
      payload: {
        entries: [
          { ...baseEntry, unitRateKes: '790.00' },
          {
            country: 'Kenya',
            stateRegion: 'Nairobi',
            city: 'Nairobi',
            itemType: 'SERVICE',
            description: 'Concrete pump hire — per day',
            unit: 'day',
            unitRateKes: '85000.00',
          },
          {
            country: 'Kenya',
            stateRegion: 'Nakuru',
            city: 'Nakuru',
            itemType: 'MATERIAL',
            materialType: 'Steel',
            materialSubType: 'Y12 rebar',
            description: 'Y12 high-yield rebar 12m',
            unit: 'piece',
            unitRateKes: '1150.00',
          },
        ],
      },
    });
    expect(bulk.statusCode, bulk.body).toBe(200);
    const summary = JSON.parse(bulk.body);
    expect(summary.created + summary.updated).toBe(3);
    // baseEntry matches the existing row -> updated, not created.
    expect(summary.updated).toBeGreaterThanOrEqual(1);

    // Re-running the same bulk must not duplicate.
    const again = await server.inject({
      method: 'POST',
      url: '/api/v1/rate-master/bulk',
      headers: authed(),
      payload: {
        entries: [
          { ...baseEntry, unitRateKes: '795' },
          {
            country: 'Kenya', stateRegion: 'Nakuru', city: 'Nakuru', itemType: 'MATERIAL',
            materialType: 'Steel', materialSubType: 'Y12 rebar',
            description: 'Y12 high-yield rebar 12m', unit: 'piece', unitRateKes: '1200',
          },
        ],
      },
    });
    expect(again.statusCode).toBe(200);
    const againSummary = JSON.parse(again.body);
    expect(againSummary.created).toBe(0);
    expect(againSummary.updated).toBe(2);

    const list = await server.inject({
      method: 'GET',
      url: '/api/v1/rate-master?q=rebar',
      headers: authed(),
    });
    const rows = JSON.parse(list.body).entries ?? [];
    const rebar = rows.filter((r: any) => /rebar/i.test(r.description));
    expect(rebar).toHaveLength(1);
    expect(rebar[0].unitRateKes).toBe('1200');
  });

  it('lookup ranks exact material-subtype matches first', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/rate-master/lookup?q=cement&unit=bag',
      headers: authed(),
    });
    expect(res.statusCode).toBe(200);
    const matches = JSON.parse(res.body).matches ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].unitRateKes).toBe('795');
    expect(matches[0].materialSubType).toBe('OPC 42.5N');
  });

  it('edits and deletes an entry', async () => {
    const patch = await server.inject({
      method: 'PATCH',
      url: `/api/v1/rate-master/${entryId}`,
      headers: authed(),
      payload: { unitRateKes: '810', notes: 'Q1 2027 price review' },
    });
    expect(patch.statusCode, patch.body).toBe(200);

    const get = await server.inject({
      method: 'GET',
      url: `/api/v1/rate-master/${entryId}`,
      headers: authed(),
    });
    expect(get.statusCode).toBe(200);
    const row = JSON.parse(get.body).entry ?? JSON.parse(get.body);
    expect(row.unitRateKes).toBe('810');
    expect(row.notes).toBe('Q1 2027 price review');

    const del = await server.inject({
      method: 'DELETE',
      url: `/api/v1/rate-master/${entryId}`,
      headers: authed(),
    });
    expect([200, 204]).toContain(del.statusCode);

    const gone = await server.inject({
      method: 'GET',
      url: `/api/v1/rate-master/${entryId}`,
      headers: authed(),
    });
    expect(gone.statusCode).toBe(404);
  });

  it('rejects invalid payloads and unauthenticated access', async () => {
    const bad = await server.inject({
      method: 'POST',
      url: '/api/v1/rate-master',
      headers: authed(),
      payload: { description: 'No rate', unit: 'bag' },
    });
    expect(bad.statusCode).toBe(400);

    const anon = await server.inject({ method: 'GET', url: '/api/v1/rate-master' });
    expect(anon.statusCode).toBe(401);
  });
});
