import { test, expect } from '@playwright/test';
import { login, apiGet, apiPost, firstProjectId, unwrap } from './helpers';

/**
 * Workflow B — diary entry queued offline then synced once.
 * The API honours Idempotency-Key on site-diary creation, so replaying
 * the same queued payload must produce exactly one record.
 */
test.describe('B. Offline diary sync', () => {
  test('same idempotency key produces no duplicate', async ({ request }) => {
    const sup = await login(request, 'supervisor@apexbuilders.co.ke');
    const projectId = await firstProjectId(request, sup);

    const payload = {
      projectId,
      entryDate: new Date().toISOString().slice(0, 10),
      weather: 'SUNNY_CLEAR',
      siteStatus: 'OPERATIONAL',
      generalNotes: 'E2E offline-sync diary entry',
      laborHeadcounts: [{ tradeType: 'MASON', headcount: 14 }],
    };
    const key = `e2e-diary-${Date.now()}`;

    const first = await apiPost(request, sup, `/api/v1/projects/${projectId}/site-diaries`, payload, {
      'idempotency-key': key,
    });
    expect(first.status(), await first.text()).toBe(201);
    const firstBody = unwrap(await first.json());
    const diaryId = firstBody.id || firstBody.diary?.id;
    expect(diaryId).toBeTruthy();

    // Simulate reconnect replay of the same queued payload
    const replay = await apiPost(request, sup, `/api/v1/projects/${projectId}/site-diaries`, payload, {
      'idempotency-key': key,
    });
    expect([200, 201]).toContain(replay.status());
    const replayBody = unwrap(await replay.json());
    expect(replayBody.id || replayBody.diary?.id).toBe(diaryId);

    // Exactly one diary for today with these notes
    const listRes = await apiGet(request, sup, `/api/v1/projects/${projectId}/site-diaries`);
    expect(listRes.status()).toBe(200);
    const list = await listRes.json();
    const un = unwrap(list);
    const rows = Array.isArray(un) ? un : un.diaries || un.data || [];
    const matches = rows.filter((d: any) =>
      (d.general_notes || d.generalNotes || '').includes('E2E offline-sync diary entry'));
    expect(matches.length).toBe(1);
  });
});
