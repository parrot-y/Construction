import { describe, expect, it } from 'vitest';
import { buildServer } from './index';

describe('API Route Permission & RBAC Enforcement Suite (Milestone M2)', () => {
  const server = buildServer();

  async function getAuthToken(email: string): Promise<string> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: 'Password123!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    return body.token;
  }

  it('rejects unauthenticated requests to protected endpoints with 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
    });

    expect(res.statusCode).toBe(401);
  });

  it('allows all roles with PROJECT_VIEW to list tenant projects', async () => {
    const roles = [
      'admin@apexbuilders.co.ke',
      'qs@apexbuilders.co.ke',
      'supervisor@apexbuilders.co.ke',
      'client@apexbuilders.co.ke',
    ];

    for (const email of roles) {
      const token = await getAuthToken(email);
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    }
  });

  it('allows Admin to create projects (PROJECT_CREATE) and generates audit log', async () => {
    const token = await getAuthToken('admin@apexbuilders.co.ke');
    const projectCode = `TEST-PRJ-${Date.now()}`;

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Automated Test Project',
        code: projectCode,
        location: 'Westlands, Nairobi',
        budget: 15000000,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.data.code).toBe(projectCode);
  });

  it('strictly blocks Site Supervisor from creating projects with 403 Forbidden', async () => {
    const token = await getAuthToken('supervisor@apexbuilders.co.ke');

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Unauthorized Supervisor Project',
        code: 'SUP-FAIL-01',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('project.create');
  });

  it('strictly blocks Client from creating projects with 403 Forbidden', async () => {
    const token = await getAuthToken('client@apexbuilders.co.ke');

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Unauthorized Client Project',
        code: 'CLI-FAIL-01',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Forbidden');
  });

  it('restricts /api/v1/company/settings (COMPANY_MANAGE) to Admin only', async () => {
    const adminToken = await getAuthToken('admin@apexbuilders.co.ke');
    const adminRes = await server.inject({
      method: 'GET',
      url: '/api/v1/company/settings',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminRes.statusCode).toBe(200);

    const nonAdminRoles = [
      'qs@apexbuilders.co.ke',
      'supervisor@apexbuilders.co.ke',
      'client@apexbuilders.co.ke',
    ];

    for (const email of nonAdminRoles) {
      const token = await getAuthToken(email);
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/company/settings',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('Forbidden');
      expect(body.message).toContain('company.manage');
    }
  });
});
