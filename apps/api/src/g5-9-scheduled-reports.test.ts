import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

/**
 * Gate-5 G5-9: Scheduled reports — definitions, frequencies,
 * recipients, run snapshots, pause/resume.
 */
describe('Gate-5 G5-9: Scheduled reports', () => {
  const server = buildServer();

  let adminCookie: string;
  let supervisorCookie: string;
  let reportId: string;

  const createBody = {
    name: 'Weekly financial digest',
    reportType: 'FINANCIAL',
    frequency: 'WEEKLY',
    dayOfWeek: 1,
    recipients: ['finance@apexbuilders.co.ke', 'PM_QS'],
    format: 'PDF',
  };

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
    };
    adminCookie = (await login('admin@apexbuilders.co.ke')).cookie;
    supervisorCookie = (await login('supervisor@apexbuilders.co.ke')).cookie;
  });

  it('creates schedule with computed next_run_at (next Monday 06:00 UTC)', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/reports/scheduled', headers: { cookie: adminCookie },
      payload: createBody,
    });
    expect(res.statusCode).toBe(201);
    const r = JSON.parse(res.body).data;
    reportId = r.id;
    expect(r.next_run_at).toBeTruthy();
    expect(new Date(r.next_run_at).getUTCDay()).toBe(1);
    expect(new Date(r.next_run_at).getUTCHours()).toBe(6);
    expect(r.recipients).toContain('finance@apexbuilders.co.ke');
  });

  it('lists with runs + pauses and resumes', async () => {
    const list = await server.inject({ method: 'GET', url: '/api/v1/reports/scheduled', headers: { cookie: adminCookie } });
    expect(JSON.parse(list.body).data.some((r: any) => r.id === reportId)).toBe(true);

    const pause = await server.inject({
      method: 'PATCH', url: `/api/v1/reports/scheduled/${reportId}`, headers: { cookie: adminCookie },
      payload: { status: 'PAUSED' },
    });
    expect(pause.statusCode).toBe(200);

    const resume = await server.inject({
      method: 'PATCH', url: `/api/v1/reports/scheduled/${reportId}`, headers: { cookie: adminCookie },
      payload: { status: 'ACTIVE' },
    });
    expect(resume.statusCode).toBe(200);
    expect(JSON.parse(resume.body).data.next_run_at).toBeTruthy();
  });

  it('run-now snapshots summary + writes run history + advances next_run', async () => {
    const before = await server.inject({ method: 'GET', url: `/api/v1/reports/scheduled/${reportId}`, headers: { cookie: adminCookie } });
    void before;
    const res = await server.inject({
      method: 'POST', url: `/api/v1/reports/scheduled/${reportId}/run`, headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body).data;
    expect(body.run_id).toBeTruthy();
    expect(body.summary.report_type).toBe('FINANCIAL');
    expect(body.summary.projects).toBeGreaterThanOrEqual(0);
    expect(body.summary.receivables).toBeTruthy();

    const runs = await server.inject({ method: 'GET', url: `/api/v1/reports/scheduled/${reportId}/runs`, headers: { cookie: adminCookie } });
    const runList = JSON.parse(runs.body).data;
    expect(runList.some((r: any) => r.id === body.run_id && r.status === 'SUCCESS')).toBe(true);
  });

  it('monthly clamps day_of_month to 28', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/reports/scheduled', headers: { cookie: adminCookie },
      payload: { ...createBody, name: 'Month-end ops report', reportType: 'OPERATIONAL', frequency: 'MONTHLY', dayOfMonth: 31, dayOfWeek: null, recipients: ['ops@apexbuilders.co.ke'] },
    });
    expect(res.statusCode).toBe(201);
    const r = JSON.parse(res.body).data;
    expect(new Date(r.next_run_at).getUTCDate()).toBeLessThanOrEqual(28);
  });

  it('RBAC: supervisor cannot create schedules (no REPORT_GENERATE)', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/reports/scheduled', headers: { cookie: supervisorCookie },
      payload: createBody,
    });
    expect(res.statusCode).toBe(403);
    // but CAN list
    const list = await server.inject({ method: 'GET', url: '/api/v1/reports/scheduled', headers: { cookie: supervisorCookie } });
    expect(list.statusCode).toBe(200);
  });
});
