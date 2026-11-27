import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

// CB5 — contractor master (Assistant QS competitive gap): a tenant-level
// register of subcontractor firms. Firms carry a KRA PIN, work categories
// and an approval status; only APPROVED firms can be linked to work
// packages. Status transitions are audited and illegal ones rejected.
describe('CB5 — contractor master register', () => {
  const server = buildServer();

  let adminCookie: string;
  let projectId: string;
  let firmId: string;

  const authed = () => ({ cookie: adminCookie });

  const createFirm = async (overrides: Record<string, any> = {}) => {
    return server.inject({
      method: 'POST',
      url: '/api/v1/contractors',
      headers: authed(),
      payload: {
        firmName: 'M-seto Electricals Ltd',
        kraPin: 'P051234567X',
        contactPerson: 'Peter Otieno',
        phone: '+254722333444',
        email: 'peter@mseto.co.ke',
        workCategories: ['ELECTRICAL', 'SOLAR'],
        notes: 'Preferred electrical subcontractor',
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
        name: 'CB5 Contractor Site',
        code: `CB5-${Date.now().toString().slice(-4)}`,
        location: 'Westlands, Nairobi',
        originalContractSum: 30000000,
      },
    });
    expect(proj.statusCode).toBe(201);
    projectId = JSON.parse(proj.body).project?.id ?? JSON.parse(proj.body).id;
  });

  it('creates a PENDING firm with KRA PIN + categories and lists it', async () => {
    const res = await createFirm();
    expect(res.statusCode, res.body).toBe(201);
    const body = JSON.parse(res.body);
    const firm = body.contractor ?? body.firm ?? body.data ?? body;
    firmId = firm.id;
    expect(firmId).toBeTruthy();
    expect(firm.firmName ?? firm.firm_name).toBe('M-seto Electricals Ltd');
    expect(firm.kraPin ?? firm.kra_pin).toBe('P051234567X');
    expect(firm.approvalStatus ?? firm.approval_status).toBe('PENDING');
    expect(firm.workCategories ?? firm.work_categories).toEqual(['ELECTRICAL', 'SOLAR']);

    const list = await server.inject({
      method: 'GET',
      url: '/api/v1/contractors?status=PENDING&category=ELECTRICAL',
      headers: authed(),
    });
    expect(list.statusCode).toBe(200);
    const rows = JSON.parse(list.body).contractors ?? JSON.parse(list.body).data ?? [];
    expect(rows.find((r: any) => r.id === firmId), 'firm in filtered list').toBeTruthy();
  });

  it('enforces KRA PIN uniqueness per tenant', async () => {
    const dup = await createFirm({ firmName: 'Copycat Electricals' });
    expect(dup.statusCode).toBe(409);
  });

  it('approve → link to package → suspend blocks new links', async () => {
    // Approving requires COST_APPROVE (admin has it).
    const approve = await server.inject({
      method: 'PATCH',
      url: `/api/v1/contractors/${firmId}`,
      headers: authed(),
      payload: { approvalStatus: 'APPROVED', statusReason: 'Docs verified' },
    });
    expect(approve.statusCode, approve.body).toBe(200);
    const approved = JSON.parse(approve.body).contractor ?? JSON.parse(approve.body);
    expect(approved.approvalStatus ?? approved.approval_status).toBe('APPROVED');
    expect(approved.approvedBy ?? approved.approved_by).toBeTruthy();

    // Link the firm to a work package on the project.
    const pkg = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/subcontractors`,
      headers: authed(),
      payload: {
        tradeCategory: 'ELECTRICAL',
        firmName: 'M-seto Electricals Ltd',
        subcontractSum: 4500000,
        contractorId: firmId,
      },
    });
    expect(pkg.statusCode, pkg.body).toBe(201);
    const pkgBody = JSON.parse(pkg.body);
    const created = pkgBody.package ?? pkgBody.subcontractor ?? pkgBody.data ?? pkgBody;
    expect(created.contractorId ?? created.contractor_id).toBe(firmId);

    // Package list surfaces the linked firm.
    const pkgs = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/subcontractors`,
      headers: authed(),
    });
    expect(pkgs.statusCode).toBe(200);
    const pkgRows = JSON.parse(pkgs.body).packages ?? [];
    const mine = pkgRows.find((r: any) => r.id === created.id);
    expect(mine.contractorFirmName ?? mine.contractor?.firmName ?? mine.contractor_firm_name).toBeTruthy();

    // Suspend the firm — new package links must now 409.
    const suspend = await server.inject({
      method: 'PATCH',
      url: `/api/v1/contractors/${firmId}`,
      headers: authed(),
      payload: { approvalStatus: 'SUSPENDED', statusReason: 'Expired insurance' },
    });
    expect(suspend.statusCode, suspend.body).toBe(200);

    const blocked = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/subcontractors`,
      headers: authed(),
      payload: {
        tradeCategory: 'SOLAR',
        firmName: 'M-seto Electricals Ltd',
        subcontractSum: 800000,
        contractorId: firmId,
      },
    });
    expect(blocked.statusCode).toBe(409);

    // Illegal transition: SUSPENDED → BLACKLISTED is allowed, BLACKLISTED → APPROVED is not.
    const blacklist = await server.inject({
      method: 'PATCH',
      url: `/api/v1/contractors/${firmId}`,
      headers: authed(),
      payload: { approvalStatus: 'BLACKLISTED', statusReason: 'Fraudulent docs' },
    });
    expect(blacklist.statusCode, blacklist.body).toBe(200);

    const revive = await server.inject({
      method: 'PATCH',
      url: `/api/v1/contractors/${firmId}`,
      headers: authed(),
      payload: { approvalStatus: 'APPROVED' },
    });
    expect(revive.statusCode).toBe(409);
  });

  it('rejects a package link to a PENDING firm and validates payloads', async () => {
    const pending = await createFirm({ firmName: 'Roofing Pros Ltd', kraPin: 'P059988877Z', workCategories: ['ROOFING'] });
    expect(pending.statusCode).toBe(201);
    const pendingId = (JSON.parse(pending.body).contractor ?? JSON.parse(pending.body).firm ?? JSON.parse(pending.body).data ?? JSON.parse(pending.body)).id;

    const pkg = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/subcontractors`,
      headers: authed(),
      payload: {
        tradeCategory: 'ROOFING',
        firmName: 'Roofing Pros Ltd',
        subcontractSum: 1200000,
        contractorId: pendingId,
      },
    });
    expect(pkg.statusCode).toBe(409);

    const bad = await createFirm({ firmName: '' });
    expect(bad.statusCode).toBe(400);

    const anon = await server.inject({ method: 'GET', url: '/api/v1/contractors' });
    expect(anon.statusCode).toBe(401);
  });
});
