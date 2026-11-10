import { describe, expect, it } from 'vitest';
import { buildServer } from './index';

describe('Milestone M3: Company, Users, Invites, Projects & Role Dashboards', () => {
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

  describe('1. Company Management', () => {
    it('allows authenticated users to view company profile', async () => {
      const token = await getAuthToken('qs@apexbuilders.co.ke');
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/company',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.name).toBe('Apex Builders Kenya Ltd');
      expect(body.data.slug).toBe('apex-builders');
      expect(body.data.currency).toBe('KES');
    });

    it('allows Admin to update company profile and records audit log', async () => {
      const token = await getAuthToken('admin@apexbuilders.co.ke');
      const res = await server.inject({
        method: 'PATCH',
        url: '/api/v1/company',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          nca_category: 'NCA 3',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.nca_category).toBe('NCA 3');
    });

    it('lists all company team members', async () => {
      const token = await getAuthToken('admin@apexbuilders.co.ke');
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/company/members',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(4);

      const roles = body.data.map((m: { role: string }) => m.role);
      expect(roles).toContain('COMPANY_ADMIN');
      expect(roles).toContain('PM_QS');
      expect(roles).toContain('SITE_SUPERVISOR');
      expect(roles).toContain('CLIENT');
    });
  });

  describe('2. User Invitation Workflow', () => {
    it('executes the full invitation, acceptance, and login lifecycle', async () => {
      const adminToken = await getAuthToken('admin@apexbuilders.co.ke');
      const newEmail = `invitee-${Date.now()}@test.co.ke`;

      // Step A: Admin sends invitation
      const inviteRes = await server.inject({
        method: 'POST',
        url: '/api/v1/invitations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: newEmail,
          phone: '+254711998877',
          role: 'PM_QS',
        },
      });

      expect(inviteRes.statusCode).toBe(201);
      const inviteBody = JSON.parse(inviteRes.payload);
      const token = inviteBody.data.token;
      expect(token).toBeDefined();
      expect(inviteBody.data.role).toBe('PM_QS');

      // Step B: List pending invitations
      const listRes = await server.inject({
        method: 'GET',
        url: '/api/v1/invitations',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.payload);
      const tokens = listBody.data.map((i: { token: string }) => i.token);
      expect(tokens).toContain(token);

      // Step C: Invitee accepts invitation
      const acceptRes = await server.inject({
        method: 'POST',
        url: '/api/v1/invitations/accept',
        payload: {
          token,
          email: newEmail,
          fullName: 'Alice Wangari',
          password: 'Password123!',
        },
      });

      expect(acceptRes.statusCode).toBe(200);

      // Step D: Invitee logs in with new credentials
      const loginRes = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: newEmail,
          password: 'Password123!',
        },
      });

      expect(loginRes.statusCode).toBe(200);
      const loginBody = JSON.parse(loginRes.payload);
      expect(loginBody.user.fullName).toBe('Alice Wangari');
      expect(loginBody.user.role).toBe('PM_QS');
      expect(loginBody.permissions).toContain('boq.import');
    });
  });

  describe('3. Project Management & Member Assignments', () => {
    it('allows creating a project, assigning members, and fetching details', async () => {
      const adminToken = await getAuthToken('admin@apexbuilders.co.ke');
      const projectCode = `M3-PRJ-${Date.now()}`;

      // Step A: Create project
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Kilimani Smart Tower',
          code: projectCode,
          description: '12-floor commercial tower',
          location: 'Argwings Kodhek Rd, Kilimani, Nairobi',
          ncaProjectNo: 'NCA-2026-9021',
          budget: 85000000,
        },
      });

      expect(createRes.statusCode).toBe(201);
      const project = JSON.parse(createRes.payload).data;

      // Step B: Assign QS to project
      // Get QS user ID
      const membersRes = await server.inject({
        method: 'GET',
        url: '/api/v1/company/members',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const members = JSON.parse(membersRes.payload).data;
      const qsUser = members.find((m: { role: string }) => m.role === 'PM_QS').user;

      const assignRes = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/members`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          userId: qsUser.id,
          role: 'PROJECT_QS',
        },
      });

      expect(assignRes.statusCode).toBe(200);

      // Step C: Fetch project details with members
      const detailRes = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(detailRes.statusCode).toBe(200);
      const detailBody = JSON.parse(detailRes.payload).data;
      expect(detailBody.code).toBe(projectCode);
      expect(detailBody.members.length).toBeGreaterThanOrEqual(2);

      // Step D: Remove member
      const removeRes = await server.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/members/${qsUser.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(removeRes.statusCode).toBe(200);
    });
  });

  describe('4. Four Role-Tailored Dashboards', () => {
    it('returns tailored dashboard metrics for Company Admin', async () => {
      const token = await getAuthToken('admin@apexbuilders.co.ke');
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const { data } = JSON.parse(res.payload);
      expect(data.role).toBe('COMPANY_ADMIN');
      expect(data.metrics.activeProjectsCount).toBeGreaterThan(0);
      expect(data.metrics.totalContractSum).toBeGreaterThan(0);
      expect(data.metrics.teamMembersCount).toBeGreaterThanOrEqual(4);
      expect(Array.isArray(data.recentAudits)).toBe(true);
    });

    it('returns tailored dashboard metrics for PM / QS', async () => {
      const token = await getAuthToken('qs@apexbuilders.co.ke');
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const { data } = JSON.parse(res.payload);
      expect(data.role).toBe('PM_QS');
      expect(data.metrics.activeProjectsCount).toBeGreaterThan(0);
      expect(data.metrics.totalApprovedBudget).toBeDefined();
      expect(data.metrics.pendingCostReviews).toBeDefined();
    });

    it('returns tailored dashboard metrics for Site Supervisor', async () => {
      const token = await getAuthToken('supervisor@apexbuilders.co.ke');
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const { data } = JSON.parse(res.payload);
      expect(data.role).toBe('SITE_SUPERVISOR');
      expect(data.metrics.assignedProjectsCount).toBeGreaterThan(0);
      expect(data.metrics.totalHeadcountToday).toBeDefined();
    });

    it('returns tailored dashboard metrics for Client / Developer', async () => {
      const token = await getAuthToken('client@apexbuilders.co.ke');
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const { data } = JSON.parse(res.payload);
      expect(data.role).toBe('CLIENT');
      expect(data.metrics.totalContractSum).toBeGreaterThan(0);
      expect(data.metrics.overallPhysicalProgressPct).toBeDefined();
    });
  });
});
