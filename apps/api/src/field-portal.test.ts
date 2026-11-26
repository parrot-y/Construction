import { describe, expect, it, beforeAll } from 'vitest';
import { prisma, withTenantTx } from '@construction/db';
import { buildServer } from './index';

// 1x1 transparent PNG — same fixture as g5-14-upload-security.test.ts
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const buildMultipart = (filename: string, mimetype: string, data: Buffer) => {
  const boundary = '----fieldportalboundary';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, data, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
};

// Site diaries are keyed by the project-local (Africa/Nairobi) calendar day.
const todayEAT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });

describe('FIELD portal: token-gated daily photo capture', () => {
  const server = buildServer();

  let adminCookie: string;
  let projectId: string;
  let fieldToken: string;
  let clientToken: string;

  beforeAll(async () => {
    await server.ready();

    const login = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = login.headers['set-cookie'] as string;
    const tenantId = JSON.parse(login.body).user.tenant.id;

    const projRes = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
    });
    projectId = JSON.parse(projRes.body).data[0].id;

    // The suite shares one project across test files — clear today's diary so
    // the "first photo of the day" assertions are deterministic.
    await withTenantTx(prisma, tenantId, (tx) =>
      tx.siteDiary.deleteMany({
        where: { project_id: projectId, entry_date: new Date(`${todayEAT()}T00:00:00.000Z`) },
      }),
    );

    const fieldRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/portals/links`,
      headers: { cookie: adminCookie },
      payload: {
        portalType: 'FIELD',
        stakeholderName: 'Juma Site Foreman',
        stakeholderRole: 'Site Foreman',
        expiresInDays: 30,
      },
    });
    expect(fieldRes.statusCode).toBe(201);
    const fieldBody = JSON.parse(fieldRes.body).data;
    expect(fieldBody.portalType).toBe('FIELD');
    expect(fieldBody.linkUrl).toContain('portal=field');
    fieldToken = fieldBody.token;

    const clientRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/portals/links`,
      headers: { cookie: adminCookie },
      payload: {
        portalType: 'CLIENT',
        stakeholderName: 'Portal Test Client',
        expiresInDays: 30,
      },
    });
    expect(clientRes.statusCode).toBe(201);
    clientToken = JSON.parse(clientRes.body).data.token;
  });

  it('returns field context: project, stakeholder, today, empty diary/photos', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/field/${fieldToken}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body).data;
    expect(body.project.id).toBe(projectId);
    expect(body.project.name).toBeTruthy();
    expect(body.stakeholderName).toBe('Juma Site Foreman');
    expect(body.entryDate).toBe(todayEAT());
    expect(body.diary).toBeNull();
    expect(body.photos).toEqual([]);
  });

  it('rejects a CLIENT-typed token on the field portal (fail-closed)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/field/${clientToken}`,
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects a bogus token', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/portals/field/deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    });
    expect(res.statusCode).toBe(404);
  });

  it('accepts a verified photo upload scoped to the link project', async () => {
    const { payload, contentType } = buildMultipart('site-photo.png', 'image/png', PNG_1PX);
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/field/${fieldToken}/uploads`,
      headers: { 'content-type': contentType },
      payload,
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body).data;
    expect(body.storageKey).toContain(projectId);
    expect(body.storageKey.endsWith('.png')).toBe(true);
    expect(body.url).toContain('/uploads/');
  });

  it('attaches the daily photo to today\'s diary with GPS + accuracy', async () => {
    // First photo of the day: no diary exists yet, so weather + siteStatus
    // are required — the field worker files the day in one tap.
    const { payload, contentType } = buildMultipart('daily-1.png', 'image/png', PNG_1PX);
    const up = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/field/${fieldToken}/uploads`,
      headers: { 'content-type': contentType },
      payload,
    });
    const storageKey = JSON.parse(up.body).data.storageKey;
    expect(storageKey).toContain(projectId);

    const missingMeta = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/field/${fieldToken}/photos`,
      payload: {
        storageKey,
        caption: 'Morning pour — grid 4-C',
        gpsLatitude: -1.286389,
        gpsLongitude: 36.817223,
        gpsAccuracyMeters: 8.5,
        takenAt: new Date().toISOString(),
      },
    });
    expect(missingMeta.statusCode).toBe(422);

    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/field/${fieldToken}/photos`,
      payload: {
        storageKey,
        caption: 'Morning pour — grid 4-C',
        gpsLatitude: -1.286389,
        gpsLongitude: 36.817223,
        gpsAccuracyMeters: 8.5,
        takenAt: new Date().toISOString(),
        weather: 'SUNNY_CLEAR',
        siteStatus: 'OPERATIONAL',
      },
    });
    expect(res.statusCode).toBe(201);
    const photo = JSON.parse(res.body).data.photo ?? JSON.parse(res.body).data;
    expect(photo.gpsLatitude ?? photo.gps_latitude).toBeDefined();

    // Context now shows today's diary + the photo
    const ctx = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/field/${fieldToken}`,
    });
    const ctxBody = JSON.parse(ctx.body).data;
    expect(ctxBody.diary).not.toBeNull();
    expect(ctxBody.diary.weather).toBe('SUNNY_CLEAR');
    expect(ctxBody.photos.length).toBe(1);
    expect(ctxBody.photos[0].caption).toBe('Morning pour — grid 4-C');
    expect(Number(ctxBody.photos[0].gpsAccuracyMeters)).toBeCloseTo(8.5, 1);
    expect(ctxBody.photos[0].url).toContain(`/api/v1/portals/field/${fieldToken}/files/`);

    // Token-scoped file serving returns the actual bytes
    const fileRes = await server.inject({
      method: 'GET',
      url: ctxBody.photos[0].url,
    });
    expect(fileRes.statusCode).toBe(200);
    expect(fileRes.headers['content-type']).toContain('image/png');
    expect(Buffer.from(fileRes.rawPayload ?? fileRes.body).equals(PNG_1PX)).toBe(true);

    // A second photo the same day needs no weather — diary already exists
    const { payload: p2, contentType: c2 } = buildMultipart('daily-2.png', 'image/png', PNG_1PX);
    const up2 = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/field/${fieldToken}/uploads`,
      headers: { 'content-type': c2 },
      payload: p2,
    });
    const key2 = JSON.parse(up2.body).data.storageKey;
    const res2 = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/field/${fieldToken}/photos`,
      payload: { storageKey: key2, caption: 'Afternoon progress' },
    });
    expect(res2.statusCode).toBe(201);

    const ctx2 = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/field/${fieldToken}`,
    });
    expect(JSON.parse(ctx2.body).data.photos.length).toBe(2);
  });

  it('refuses storage keys outside the link project and bogus payloads', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/field/${fieldToken}/photos`,
      payload: { storageKey: 'other-tenant/other-project/secret.png' },
    });
    expect([400, 404]).toContain(res.statusCode);

    const bad = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/field/${fieldToken}/photos`,
      payload: { caption: 'no storage key' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('the filed diary and photo are visible to the project team', async () => {
    const diaries = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/site-diaries`,
      headers: { cookie: adminCookie },
    });
    expect(diaries.statusCode).toBe(200);
    const rows = JSON.parse(diaries.body).data ?? [];
    const today = rows.find((d: any) => String(d.entry_date).slice(0, 10) === todayEAT());
    expect(today).toBeDefined();
    const photos = today.photos ?? [];
    expect(photos.length).toBeGreaterThanOrEqual(2);
    const withGps = photos.find((p: any) => p.gps_latitude != null);
    expect(withGps).toBeDefined();
    expect(Number(withGps.gps_accuracy_meters)).toBeCloseTo(8.5, 1);
  });
});
