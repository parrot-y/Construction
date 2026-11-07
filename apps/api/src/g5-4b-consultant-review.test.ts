import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

/**
 * Gate-5 G5-4b: Consultant approval chain on inspections —
 * requires_consultant_review pauses auto-approval at
 * PENDING_CONSULTANT_REVIEW until INSPECTION_REVIEW decision.
 */
describe('Gate-5 G5-4b: Consultant approval chain on inspections', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let projectId: string;
  let checklistId: string;
  let itemIds: string[] = [];

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
    };
    adminCookie = (await login('admin@apexbuilders.co.ke')).cookie;
    qsCookie = (await login('qs@apexbuilders.co.ke')).cookie;
    const res = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie: adminCookie } });
    projectId = JSON.parse(res.body).data[0].id;
  });

  it('creates checklist requiring consultant review; items pause at PENDING_CONSULTANT_REVIEW', async () => {
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/inspections`, headers: { cookie: adminCookie },
      payload: {
        checklistType: 'PRE_POUR_CONCRETE',
        title: 'ZZ-RESEARCH pre-pour inspection — consultant chain',
        location: 'Block A, Grid 1-4',
        scheduledDate: '2026-11-10',
        requiresConsultantReview: true,
        items: [
          { orderIdx: 1, checkPoint: 'Rebar cover blocks in place', isMandatory: true },
          { orderIdx: 2, checkPoint: 'Formwork alignment within tolerance', isMandatory: true },
          { orderIdx: 3, checkPoint: 'Site cleanliness', isMandatory: false },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const cl = JSON.parse(res.body);
    checklistId = cl.id;
    expect(cl.requires_consultant_review).toBe(true);
    expect(cl.consultant_review_status).toBe('PENDING');
    itemIds = cl.items.map((i: any) => i.id);
    expect(itemIds).toHaveLength(3);
  });

  it('passing all items lands at PENDING_CONSULTANT_REVIEW not APPROVED', async () => {
    for (const itemId of itemIds) {
      const res = await server.inject({
        method: 'PUT', url: `/api/v1/projects/${projectId}/inspections/${checklistId}/items/${itemId}`, headers: { cookie: adminCookie },
        payload: { result: 'PASS' },
      });
      expect(res.statusCode).toBe(200);
    }
    const list = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/inspections`, headers: { cookie: adminCookie } });
    const cl = JSON.parse(list.body).find((c: any) => c.id === checklistId);
    expect(cl.status).toBe('PENDING_CONSULTANT_REVIEW');
    expect(cl.signed_off_by_id).toBeNull();
  });

  it('consultant review APPROVE restores approval status + records reviewer', async () => {
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/inspections/${checklistId}/consultant-review`, headers: { cookie: qsCookie },
      payload: { decision: 'APPROVE', notes: 'All mandatory items verified on site' },
    });
    expect(res.statusCode).toBe(200);
    const cl = JSON.parse(res.body);
    expect(cl.status).toBe('APPROVED_WITHOUT_COMMENTS'); // all items PASS
    expect(cl.consultant_review_status).toBe('APPROVED');
    expect(cl.consultant_reviewed_by_name).toBeTruthy();
    expect(cl.signed_off_by_id).toBeTruthy();
  });

  it('second checklist: REJECT returns to IN_PROGRESS; re-review blocked until items re-pass', async () => {
    const create = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/inspections`, headers: { cookie: adminCookie },
      payload: {
        checklistType: 'PRE_POUR_CONCRETE', title: 'ZZ-RESEARCH second inspection — reject path',
        location: 'Block B', scheduledDate: '2026-11-11', requiresConsultantReview: true,
        items: [{ orderIdx: 1, checkPoint: 'Mandatory check', isMandatory: true }],
      },
    });
    const cl2 = JSON.parse(create.body);
    const itemId = cl2.items[0].id;
    await server.inject({
      method: 'PUT', url: `/api/v1/projects/${projectId}/inspections/${cl2.id}/items/${itemId}`, headers: { cookie: adminCookie },
      payload: { result: 'PASS' },
    });
    // now at PENDING_CONSULTANT_REVIEW — reject it
    const rej = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/inspections/${cl2.id}/consultant-review`, headers: { cookie: qsCookie },
      payload: { decision: 'REJECT', notes: 'Cover inadequate — remediate and re-inspect' },
    });
    expect(rej.statusCode).toBe(200);
    expect(JSON.parse(rej.body).status).toBe('IN_PROGRESS');
    expect(JSON.parse(rej.body).consultant_review_status).toBe('REJECTED');

    // items still all PASS → re-running item update pushes back to PENDING_CONSULTANT_REVIEW
    const again = await server.inject({
      method: 'PUT', url: `/api/v1/projects/${projectId}/inspections/${cl2.id}/items/${itemId}`, headers: { cookie: adminCookie },
      payload: { result: 'PASS' },
    });
    expect(JSON.parse(again.body).checklist.status).toBe('PENDING_CONSULTANT_REVIEW');

    // double review while approved → 400
    const dup = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/inspections/${cl2.id}/consultant-review`, headers: { cookie: qsCookie },
      payload: { decision: 'APPROVE' },
    });
    expect(dup.statusCode).toBe(200); // it IS pending review again — allowed
    const after = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/inspections/${cl2.id}/consultant-review`, headers: { cookie: qsCookie },
      payload: { decision: 'APPROVE' },
    });
    expect(after.statusCode).toBe(400); // no longer pending
  });

  it('inspection without consultant requirement unaffected (auto-approves)', async () => {
    const create = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/inspections`, headers: { cookie: adminCookie },
      payload: {
        checklistType: 'PRE_POUR_CONCRETE', title: 'ZZ-RESEARCH no-chain inspection',
        location: 'Block C', scheduledDate: '2026-11-12',
        items: [{ orderIdx: 1, checkPoint: 'Check', isMandatory: true }],
      },
    });
    const cl3 = JSON.parse(create.body);
    expect(cl3.consultant_review_status).toBe('NOT_REQUIRED');
    await server.inject({
      method: 'PUT', url: `/api/v1/projects/${projectId}/inspections/${cl3.id}/items/${cl3.items[0].id}`, headers: { cookie: adminCookie },
      payload: { result: 'PASS' },
    });
    const list = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/inspections`, headers: { cookie: adminCookie } });
    const found = JSON.parse(list.body).find((c: any) => c.id === cl3.id);
    expect(found.status).toBe('APPROVED_WITHOUT_COMMENTS');
  });
});
