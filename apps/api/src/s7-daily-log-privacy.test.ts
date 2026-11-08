import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { enrollAllTenantUsers } from './test-members';

/**
 * Gate-4 S7: Daily logs & field ops privacy.
 * - is_non_work_day flag on diaries
 * - per-photo client_visible opt-in (default false)
 * - PATCH photo visibility endpoint
 * - client portal exposes ONLY opted-in photos + a safe daily_updates
 *   summary; diary notes/general_notes are never exposed.
 */
describe('Gate-4 S7: Daily log privacy & field ops', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let tenantAId: string;
  let projectId: string;
  let diaryId: string;
  let visiblePhotoId: string;
  let hiddenPhotoId: string;

  beforeAll(async () => {
    await server.ready();

    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
    };
    const admin = await login('admin@apexbuilders.co.ke');
    adminCookie = admin.cookie;
    tenantAId = admin.body.user.tenant.id;
    qsCookie = (await login('qs@apexbuilders.co.ke')).cookie;

    await withTenantTx(prisma, tenantAId, async (tx) => {
      const proj = await tx.project.create({
        data: {
          tenant_id: tenantAId,
          code: `S7-DL-${Date.now().toString().slice(-6)}`,
          name: 'S7 Daily Log Privacy Project',
          status: 'ACTIVE',
          original_contract_sum: '10000000.00',
          current_approved_budget: '10000000.00',
        },
      });
      projectId = proj.id;

    });
        await enrollAllTenantUsers(projectId);
  });

  it('records a non-work-day diary with mixed photo visibility', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/site-diaries`,
      headers: { cookie: qsCookie, 'idempotency-key': `s7-${Date.now()}` },
      payload: {
        entryDate: '2026-11-01',
        weather: 'SUNNY_CLEAR',
        siteStatus: 'OPERATIONAL',
        generalNotes: 'INTERNAL: labour dispute on Block C, do not share with client',
        isNonWorkDay: false,
        laborHeadcounts: [{ tradeType: 'Mason', headcount: 12 }],
        photos: [
          { storageKey: 's7/public-progress.jpg', caption: 'Slab pour progress', clientVisible: true, gpsLatitude: -1.29, gpsLongitude: 36.82 },
          { storageKey: 's7/internal-issue.jpg', caption: 'Rebar placement issue', clientVisible: false },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const diary = JSON.parse(res.body).data;
    diaryId = diary.id;
    expect(diary.is_non_work_day).toBe(false);
    const photos = diary.photos;
    expect(photos).toHaveLength(2);
    visiblePhotoId = photos.find((p: any) => p.storage_key === 's7/public-progress.jpg').id;
    hiddenPhotoId = photos.find((p: any) => p.storage_key === 's7/internal-issue.jpg').id;
    expect(photos.find((p: any) => p.id === visiblePhotoId).client_visible).toBe(true);
    expect(photos.find((p: any) => p.id === hiddenPhotoId).client_visible).toBe(false);
  });

  it('records a non-work-day entry flag', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/site-diaries`,
      headers: { cookie: qsCookie, 'idempotency-key': `s7b-${Date.now()}` },
      payload: {
        entryDate: '2026-11-02',
        weather: 'SUNNY_CLEAR',
        siteStatus: 'STOPPED',
        generalNotes: 'Sunday — site closed',
        isNonWorkDay: true,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).data.is_non_work_day).toBe(true);
  });

  it('toggles photo client visibility via PATCH', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/site-diaries/${diaryId}/photos/${hiddenPhotoId}/visibility`,
      headers: { cookie: qsCookie },
      payload: { clientVisible: true },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.client_visible).toBe(true);

    // 404 for photo outside diary scope
    const bad = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/site-diaries/${diaryId}/photos/00000000-0000-0000-0000-000000000000/visibility`,
      headers: { cookie: qsCookie },
      payload: { clientVisible: true },
    });
    expect(bad.statusCode).toBe(404);
  });

  it('client portal exposes only opted-in photos and never diary notes', async () => {
    // Re-hide the second photo to test filtering deterministically
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/site-diaries/${diaryId}/photos/${hiddenPhotoId}/visibility`,
      headers: { cookie: qsCookie },
      payload: { clientVisible: false },
    });

    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/client-portal`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // photo_evidence contains only the visible photo
    const evidence = body.photo_evidence || body.data?.photo_evidence || [];
    expect(evidence.length).toBe(1);
    expect(evidence[0].photo_url).toContain('public-progress');

    // daily_updates summary present with safe fields only
    const updates = body.daily_updates || body.data?.daily_updates || [];
    expect(updates.length).toBeGreaterThanOrEqual(2);
    const sunday = updates.find((u: any) => u.entry_date === '2026-11-02');
    expect(sunday).toBeTruthy();
    expect(sunday.is_non_work_day).toBe(true);
    expect(sunday.site_status).toBe('STOPPED');
    expect(sunday.visible_photo_count).toBe(0);

    // notes/general_notes must NEVER appear anywhere in the portal payload
    const raw = res.body;
    expect(raw).not.toContain('INTERNAL');
    expect(raw).not.toContain('labour dispute');
    expect(raw).not.toContain('general_notes');
  });
});
