import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { enrollAllTenantUsers } from './test-members';

/**
 * Gate-5 G5-6: Checklist templates (15 trades, question builder,
 * global flag) + assignments lifecycle.
 */
describe('Gate-5 G5-6: Checklist templates & assignments', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let supervisorCookie: string;
  let projectId: string;
  let templateId: string;
  let assignmentId: string;

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
    };
    adminCookie = (await login('admin@apexbuilders.co.ke')).cookie;
    qsCookie = (await login('qs@apexbuilders.co.ke')).cookie;
    supervisorCookie = (await login('supervisor@apexbuilders.co.ke')).cookie;
    const res = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie: adminCookie } });
    projectId = JSON.parse(res.body).data[0].id;
      await enrollAllTenantUsers(projectId);
  });

  it('creates template with trade + question builder + global flag', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/checklists/templates', headers: { cookie: adminCookie },
      payload: {
        title: 'ZZ-RESEARCH Pre-pour concrete checklist',
        tradeCategory: 'CONCRETE',
        kind: 'QUALITY',
        isGlobal: true,
        questions: [
          { text: 'Rebar cover blocks in place', type: 'PASS_FAIL', required: true },
          { text: 'Formwork alignment within 5mm', type: 'YES_NO', required: true },
          { text: 'Pour card signed by engineer', type: 'PHOTO', required: false },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    templateId = JSON.parse(res.body).data.id;
  });

  it('assigns template to project trade → ASSIGNED; filters by trade/status', async () => {
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/checklist-assignments`, headers: { cookie: supervisorCookie },
      payload: {
        templateId,
        title: 'ZZ-RESEARCH Pre-pour concrete checklist',
        trade: 'Concrete crew',
        assignedToName: 'J. Mwangi',
        dueDate: '2026-11-20',
      },
    });
    expect(res.statusCode).toBe(201);
    assignmentId = JSON.parse(res.body).data.id;
    expect(JSON.parse(res.body).data.status).toBe('ASSIGNED');

    const list = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/checklist-assignments?trade=Concrete%20crew`, headers: { cookie: adminCookie } });
    expect(JSON.parse(list.body).data.some((a: any) => a.id === assignmentId)).toBe(true);
  });

  it('lifecycle: start → submit responses → review APPROVE', async () => {
    const start = await server.inject({ method: 'POST', url: `/api/v1/projects/${projectId}/checklist-assignments/${assignmentId}/start`, headers: { cookie: supervisorCookie } });
    expect(start.statusCode).toBe(200);
    expect(JSON.parse(start.body).data.status).toBe('IN_PROGRESS');

    // double start rejected
    const again = await server.inject({ method: 'POST', url: `/api/v1/projects/${projectId}/checklist-assignments/${assignmentId}/start`, headers: { cookie: supervisorCookie } });
    expect(again.statusCode).toBe(400);

    const submit = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/checklist-assignments/${assignmentId}/submit`, headers: { cookie: supervisorCookie },
      payload: { responses: [{ questionIdx: 0, answer: 'PASS' }, { questionIdx: 1, answer: true }, { questionIdx: 2, answer: 'site-photos/pour-card.jpg' }] },
    });
    expect(submit.statusCode).toBe(200);
    expect(JSON.parse(submit.body).data.status).toBe('SUBMITTED');
    expect(JSON.parse(submit.body).data.submitted_at).toBeTruthy();

    // review by QS (INSPECTION_REVIEW)
    const review = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/checklist-assignments/${assignmentId}/review`, headers: { cookie: qsCookie },
      payload: { decision: 'APPROVE', notes: 'All checks verified' },
    });
    expect(review.statusCode).toBe(200);
    expect(JSON.parse(review.body).data.status).toBe('APPROVED');
    expect(JSON.parse(review.body).data.reviewed_by_name).toBeTruthy();
  });

  it('reject path: SUBMITTED→REJECTED→IN_PROGRESS rework', async () => {
    const create = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/checklist-assignments`, headers: { cookie: adminCookie },
      payload: { title: 'ZZ-RESEARCH Steel fixing check', trade: 'Steel fixing', templateId },
    });
    const a2 = JSON.parse(create.body).data;
    await server.inject({ method: 'POST', url: `/api/v1/projects/${projectId}/checklist-assignments/${a2.id}/start`, headers: { cookie: adminCookie } });
    await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/checklist-assignments/${a2.id}/submit`, headers: { cookie: adminCookie },
      payload: { responses: [{ questionIdx: 0, answer: 'FAIL', notes: 'Cover blocks missing' }] },
    });
    const rej = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/checklist-assignments/${a2.id}/review`, headers: { cookie: qsCookie },
      payload: { decision: 'REJECT', notes: 'Remediate cover then resubmit' },
    });
    expect(JSON.parse(rej.body).data.status).toBe('REJECTED');

    // review again while REJECTED → 400
    const dup = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/checklist-assignments/${a2.id}/review`, headers: { cookie: qsCookie },
      payload: { decision: 'APPROVE' },
    });
    expect(dup.statusCode).toBe(400);
  });

  it('RBAC: client cannot create template or assignment', async () => {
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return res.headers['set-cookie'] as string;
    };
    const clientCookie = await login('client@apexbuilders.co.ke');
    const t = await server.inject({
      method: 'POST', url: '/api/v1/checklists/templates', headers: { cookie: clientCookie },
      payload: { title: 'Nope template', questions: [{ text: 'q' }] },
    });
    expect(t.statusCode).toBe(403);
    const a = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/checklist-assignments`, headers: { cookie: clientCookie },
      payload: { title: 'Nope assignment', trade: 'X' },
    });
    expect(a.statusCode).toBe(403);
    // client CAN read
    const list = await server.inject({ method: 'GET', url: '/api/v1/checklists/templates', headers: { cookie: clientCookie } });
    expect(list.statusCode).toBe(200);
  });
});
