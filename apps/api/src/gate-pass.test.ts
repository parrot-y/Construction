import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

// CB3 — gate pass (Assistant QS competitive gap): a material-exit
// authorization register. A pass is created PENDING, authorized by a
// COST_APPROVE role, then confirmed EXITED at the gate with the vehicle
// and timestamp recorded. Illegal transitions must 409.
describe('CB3 — gate pass register', () => {
  const server = buildServer();

  let adminCookie: string;
  let projectId: string;
  let passId: string;

  const authed = () => ({ cookie: adminCookie });

  const createPass = async (overrides: Record<string, any> = {}) => {
    return server.inject({
      method: 'POST',
      url: '/api/v1/gate-passes',
      headers: authed(),
      payload: {
        projectId,
        storeLocation: 'Nairobi Main Store',
        issuedToName: 'John Kamau — driver',
        issuedToPhone: '+254722000111',
        destination: 'Kilimani Apartments site',
        vehicleRegistration: 'KDA 123X',
        purpose: 'Foundation pour materials',
        items: [
          { description: 'Cement 50kg', unit: 'bag', quantity: '200' },
          { description: 'Ballast 20mm', unit: 'm3', quantity: '15' },
        ],
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
        name: 'CB3 Gate Pass Site',
        code: `CB3-${Date.now().toString().slice(-4)}`,
        location: 'Kilimani, Nairobi',
        originalContractSum: 50000000,
      },
    });
    expect(proj.statusCode).toBe(201);
    projectId = JSON.parse(proj.body).project?.id ?? JSON.parse(proj.body).id;
  });

  it('creates a PENDING pass with an atomic pass number and lists it', async () => {
    const res = await createPass();
    expect(res.statusCode, res.body).toBe(201);
    const body = JSON.parse(res.body);
    const pass = body.pass ?? body.gatePass ?? body.data ?? body;
    passId = pass.id;
    expect(passId).toBeTruthy();
    expect(pass.passNumber ?? pass.pass_number).toMatch(/^GATE-/);
    expect(pass.status).toBe('PENDING');
    expect(pass.items).toHaveLength(2);

    const list = await server.inject({
      method: 'GET',
      url: `/api/v1/gate-passes?projectId=${projectId}&status=PENDING`,
      headers: authed(),
    });
    expect(list.statusCode).toBe(200);
    const rows = JSON.parse(list.body).passes ?? JSON.parse(list.body).data ?? [];
    const mine = rows.find((r: any) => r.id === passId);
    expect(mine, 'created pass in filtered list').toBeTruthy();
    expect(mine.vehicleRegistration ?? mine.vehicle_registration).toBe('KDA 123X');
  });

  it('authorizes then confirms exit — recording who/when/vehicle', async () => {
    const auth = await server.inject({
      method: 'POST',
      url: `/api/v1/gate-passes/${passId}/authorize`,
      headers: authed(),
      payload: {},
    });
    expect(auth.statusCode, auth.body).toBe(200);
    const authedPass = JSON.parse(auth.body).pass ?? JSON.parse(auth.body);
    expect(authedPass.status).toBe('AUTHORIZED');
    expect(authedPass.authorizedBy ?? authedPass.authorized_by).toBeTruthy();

    const exit = await server.inject({
      method: 'POST',
      url: `/api/v1/gate-passes/${passId}/exit`,
      headers: authed(),
      payload: { vehicleRegistration: 'KDA 123X' },
    });
    expect(exit.statusCode, exit.body).toBe(200);
    const exited = JSON.parse(exit.body).pass ?? JSON.parse(exit.body);
    expect(exited.status).toBe('EXITED');
    expect(exited.exitedAt ?? exited.exited_at).toBeTruthy();
    expect(exited.exitConfirmedBy ?? exited.exit_confirmed_by).toBeTruthy();
  });

  it('rejects illegal transitions and cancels a fresh pass', async () => {
    // EXITED pass cannot be authorized or exited again.
    const reauth = await server.inject({
      method: 'POST',
      url: `/api/v1/gate-passes/${passId}/authorize`,
      headers: authed(),
      payload: {},
    });
    expect(reauth.statusCode).toBe(409);
    const reexit = await server.inject({
      method: 'POST',
      url: `/api/v1/gate-passes/${passId}/exit`,
      headers: authed(),
      payload: {},
    });
    expect(reexit.statusCode).toBe(409);

    // Fresh pass: cancel from PENDING works; EXITED cannot be cancelled.
    const fresh = await createPass({ issuedToName: 'Anne Wanjiru' });
    expect(fresh.statusCode).toBe(201);
    const freshId = (JSON.parse(fresh.body).pass ?? JSON.parse(fresh.body).data ?? JSON.parse(fresh.body)).id;

    const cancel = await server.inject({
      method: 'POST',
      url: `/api/v1/gate-passes/${freshId}/cancel`,
      headers: authed(),
      payload: { reason: 'Driver failed inspection' },
    });
    expect(cancel.statusCode, cancel.body).toBe(200);
    expect((JSON.parse(cancel.body).pass ?? JSON.parse(cancel.body)).status).toBe('CANCELLED');

    const lateCancel = await server.inject({
      method: 'POST',
      url: `/api/v1/gate-passes/${passId}/cancel`,
      headers: authed(),
      payload: {},
    });
    expect(lateCancel.statusCode).toBe(409);
  });

  it('validates payloads and requires auth', async () => {
    const bad = await createPass({ items: [] });
    expect(bad.statusCode).toBe(400);

    const anon = await server.inject({ method: 'GET', url: '/api/v1/gate-passes' });
    expect(anon.statusCode).toBe(401);
  });
});
