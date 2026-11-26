import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { processExportJob } from './jobs/queue';

describe('P5.10 — slow work off the request path: queued xlsx exports + deferred report delivery', () => {
  const server = buildServer();

  let adminCookie: string;
  let projectId: string;

  beforeAll(async () => {
    await server.ready();
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;
    const projRes = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie: adminCookie } });
    projectId = JSON.parse(projRes.body).data[0].id;
  });

  it('queues an export job, worker builds the xlsx, download serves it', async () => {
    const req = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/reports/financials/export`,
      headers: { cookie: adminCookie },
    });
    expect(req.statusCode).toBe(202);
    const { jobId } = JSON.parse(req.body).data;
    expect(jobId).toBeTruthy();

    // No worker is running under buildServer — the job stays PENDING until processed.
    const pending = await server.inject({ method: 'GET', url: `/api/v1/export-jobs/${jobId}`, headers: { cookie: adminCookie } });
    expect(pending.statusCode).toBe(200);
    expect(JSON.parse(pending.body).data.status).toBe('PENDING');

    await processExportJob(jobId);

    const ready = await server.inject({ method: 'GET', url: `/api/v1/export-jobs/${jobId}`, headers: { cookie: adminCookie } });
    const job = JSON.parse(ready.body).data;
    expect(job.status).toBe('READY');
    expect(job.filename).toMatch(/financials-.*\.xlsx$/);

    const dl = await server.inject({ method: 'GET', url: `/api/v1/export-jobs/${jobId}/download`, headers: { cookie: adminCookie } });
    expect(dl.statusCode).toBe(200);
    expect(String(dl.headers['content-type'])).toContain('spreadsheetml');
    // xlsx is a zip — PK magic bytes.
    expect(dl.rawPayload.slice(0, 2).toString()).toBe('PK');
    expect(dl.rawPayload.length).toBeGreaterThan(1000);
  });

  it('cost export kind works and export endpoints require auth', async () => {
    const req = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/reports/cost/export`,
      headers: { cookie: adminCookie },
    });
    expect(req.statusCode).toBe(202);
    const { jobId } = JSON.parse(req.body).data;
    await processExportJob(jobId);
    const dl = await server.inject({ method: 'GET', url: `/api/v1/export-jobs/${jobId}/download`, headers: { cookie: adminCookie } });
    expect(dl.statusCode).toBe(200);

    const anon = await server.inject({ method: 'POST', url: `/api/v1/projects/${projectId}/reports/financials/export` });
    expect(anon.statusCode).toBe(401);
  });

  it('manual report run reports delivery status (inline when queue is down)', async () => {
    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/reports/scheduled',
      headers: { cookie: adminCookie },
      payload: {
        name: 'Deferred delivery fixture',
        reportType: 'FINANCIAL',
        frequency: 'DAILY',
        recipients: ['reports@apexbuilders.co.ke'],
        format: 'JSON',
      },
    });
    expect(create.statusCode).toBe(201);
    const reportId = JSON.parse(create.body).data.id;

    const run = await server.inject({
      method: 'POST',
      url: `/api/v1/reports/scheduled/${reportId}/run`,
      headers: { cookie: adminCookie },
    });
    expect(run.statusCode).toBe(200);
    const data = JSON.parse(run.body).data;
    expect(data.run_id).toBeTruthy();
    // Queue is not running under buildServer → deliveries fall back inline.
    expect(['DONE', 'QUEUED']).toContain(data.deliveriesStatus);
    expect(Array.isArray(data.deliveries)).toBe(true);
  });
});
