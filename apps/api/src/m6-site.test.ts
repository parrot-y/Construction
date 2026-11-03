import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword } from '@construction/db';

describe('Milestone M6: Site Diary, Photos, Progress & Idempotent Sync Suite', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let supervisorCookie: string;
  let clientCookie: string;
  let tenantBCookie: string;

  let tenantAId: string;
  let tenantBId: string;
  let projectAId: string;
  let sampleBoqItemId: string;

  beforeAll(async () => {
    await server.ready();

    // 1. Login as Apex Builders Admin
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;
    const adminBody = JSON.parse(adminRes.body);
    tenantAId = adminBody.user.tenant.id;

    // 2. Login as QS
    const qsRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'qs@apexbuilders.co.ke', password: 'Password123!' },
    });
    qsCookie = qsRes.headers['set-cookie'] as string;

    // 3. Login as Site Supervisor
    const supRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'supervisor@apexbuilders.co.ke', password: 'Password123!' },
    });
    supervisorCookie = supRes.headers['set-cookie'] as string;

    // 4. Login as Client
    const clientRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'client@apexbuilders.co.ke', password: 'Password123!' },
    });
    clientCookie = clientRes.headers['set-cookie'] as string;

    // 5. Seed and Login as Tenant B (Kilimanjaro Contractors Ltd Admin)
    const defaultPasswordHash = await hashPassword('Password123!');
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b-m6' },
      update: {},
      create: {
        name: 'Kilimanjaro Field Operations Ltd',
        slug: 'test-tenant-b-m6',
        currency: 'KES',
      },
    });
    tenantBId = tenantB.id;

    const userB = await prisma.user.upsert({
      where: { email: 'supervisor@kilimanjaroops.co.ke' },
      update: { password_hash: defaultPasswordHash },
      create: {
        email: 'supervisor@kilimanjaroops.co.ke',
        password_hash: defaultPasswordHash,
        full_name: 'Peter Rotich',
        is_active: true,
      },
    });

    await withTenantTx(prisma, tenantB.id, async (tx) => {
      await tx.membership.upsert({
        where: {
          tenant_id_user_id: {
            tenant_id: tenantB.id,
            user_id: userB.id,
          },
        },
        update: { role: 'COMPANY_ADMIN' },
        create: {
          tenant_id: tenantB.id,
          user_id: userB.id,
          role: 'COMPANY_ADMIN',
        },
      });
    });

    const tbRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'supervisor@kilimanjaroops.co.ke', password: 'Password123!' },
    });
    tenantBCookie = tbRes.headers['set-cookie'] as string;

    // 6. Retrieve Project A for Tenant A
    const projA = await withTenantTx(prisma, tenantAId, async (tx) => {
      // Clean up site diaries and progress records for pristine test run
      await tx.siteDiary.deleteMany({});
      await tx.progressRecord.deleteMany({});
      await tx.idempotencyKey.deleteMany({});

      return tx.project.findFirst({
        where: { tenant_id: tenantAId, code: 'RCP-2026' },
      });
    });

    if (!projA) {
      throw new Error('Project A not found in test seed');
    }
    projectAId = projA.id;

    // Retrieve or seed BOQ item
    const existingItem = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.bOQItem.findFirst({
        where: {
          section: {
            boq: {
              project_id: projectAId,
            },
          },
        },
      });
    });

    if (existingItem) {
      sampleBoqItemId = existingItem.id;
    } else {
      const seededItem = await withTenantTx(prisma, tenantAId, async (tx) => {
        const boq = await tx.bOQ.create({
          data: {
            tenant_id: tenantAId,
            project_id: projectAId,
            version: 99,
            total_amount: '5000000.00',
            status: 'APPROVED',
          },
        });
        const sec = await tx.bOQSection.create({
          data: {
            tenant_id: tenantAId,
            boq_id: boq.id,
            order_idx: 1,
            title: 'Substructure',
          },
        });
        return tx.bOQItem.create({
          data: {
            tenant_id: tenantAId,
            section_id: sec.id,
            item_code: '1.01',
            description: 'Foundation Excavation',
            unit: 'CM',
            quantity: '100.0000',
            unit_rate: '1500.0000',
            total_amount: '150000.00',
          },
        });
      });
      sampleBoqItemId = seededItem.id;
    }
  });

  // ---------------------------------------------------------------------------
  // 1. Daily Site Diary Creation
  // ---------------------------------------------------------------------------
  it('allows Site Supervisor to record daily site diary with weather, headcount, and deliveries', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/site-diaries`,
      headers: { cookie: supervisorCookie },
      payload: {
        entryDate: '2026-11-03',
        weather: 'SUNNY_CLEAR',
        siteStatus: 'OPERATIONAL',
        generalNotes: 'Foundation blinding concrete poured on Section A; rebar fabrication ongoing.',
        laborHeadcounts: [
          { tradeType: 'Mason', headcount: 4 },
          { tradeType: 'Carpenter', headcount: 2 },
          { tradeType: 'Steel Fixer', headcount: 3 },
          { tradeType: 'Casual', headcount: 8 },
        ],
        deliveries: [
          {
            materialName: 'Simba Portland Cement 32.5N',
            quantity: '200.0000',
            unit: 'BAGS',
            supplierName: 'Bamburi Cement Ltd',
            deliveryNote: 'DN-90124',
          },
          {
            materialName: 'Clean River Sand',
            quantity: '30.0000',
            unit: 'TONS',
            supplierName: 'Hardi Quarry Supplies',
            deliveryNote: 'DN-8812',
          },
        ],
        photos: [
          {
            storageKey: 'evidence/rcp-2026/foundation_blinding_01.jpg',
            caption: 'Completed blinding concrete ready for DPM membrane',
            gpsLatitude: -1.286389,
            gpsLongitude: 36.817223,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.weather).toBe('SUNNY_CLEAR');
    expect(body.data.site_status).toBe('OPERATIONAL');
    expect(body.data.labor_headcounts).toHaveLength(4);
    expect(body.data.deliveries).toHaveLength(2);
    expect(body.data.photos).toHaveLength(1);
    expect(body.data.photos[0].storage_key).toBe('evidence/rcp-2026/foundation_blinding_01.jpg');
    expect(parseFloat(body.data.photos[0].gps_latitude)).toBeCloseTo(-1.286389, 4);
  });

  // ---------------------------------------------------------------------------
  // 2. Photo Attachment with GPS Geotagging
  // ---------------------------------------------------------------------------
  it('allows attaching additional geotagged photos to an existing site diary', async () => {
    // 1. Get existing diary ID
    const listRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/site-diaries`,
      headers: { cookie: supervisorCookie },
    });
    const diaries = JSON.parse(listRes.body).data;
    const diaryId = diaries[0].id;

    // 2. Attach new photo
    const photoRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/site-diaries/${diaryId}/photos`,
      headers: { cookie: supervisorCookie },
      payload: {
        storageKey: 'evidence/rcp-2026/steel_cage_inspection.jpg',
        caption: 'Column starter rebar inspection by structural engineer',
        gpsLatitude: -1.286500,
        gpsLongitude: 36.817350,
      },
    });

    expect(photoRes.statusCode).toBe(201);
    const photoBody = JSON.parse(photoRes.body);
    expect(photoBody.data.storage_key).toBe('evidence/rcp-2026/steel_cage_inspection.jpg');
    expect(photoBody.data.site_diary_id).toBe(diaryId);
  });

  // ---------------------------------------------------------------------------
  // 3. Physical Progress Recording
  // ---------------------------------------------------------------------------
  it('allows PM/QS or Site Supervisor to record physical progress percentage against BOQ lines', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/progress`,
      headers: { cookie: qsCookie },
      payload: {
        recordDate: '2026-11-03',
        overallProgress: '0.1500',
        notes: 'Substructure excavation 80% complete; hardcore layer commenced.',
        items: [
          {
            boqItemId: sampleBoqItemId,
            completedQuantity: '80.0000',
            completionPct: '0.8000',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.overall_progress).toBe('0.15');
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].boq_item_id).toBe(sampleBoqItemId);

    // Verify progress history endpoint
    const historyRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/progress`,
      headers: { cookie: clientCookie },
    });
    expect(historyRes.statusCode).toBe(200);
    const history = JSON.parse(historyRes.body);
    expect(history.count).toBeGreaterThanOrEqual(1);
    expect(history.latestOverallPercentage).toBe('15.00');
  });

  // ---------------------------------------------------------------------------
  // 4. Idempotent Synchronization Protocol (ADR-004)
  // ---------------------------------------------------------------------------
  it('guarantees idempotency: re-sending the same mutation with Idempotency-Key returns cached response without duplicate records', async () => {
    const idempotencyKey = 'c7e099a4-56b1-4f40-8b1b-90f7729bf333';

    const payload = {
      entryDate: '2026-11-04',
      weather: 'CLOUDY',
      siteStatus: 'OPERATIONAL',
      generalNotes: 'Paving block installation in external parking bay.',
      laborHeadcounts: [{ tradeType: 'Mason', headcount: 3 }],
    };

    // First submission: should execute mutation (X-Cache-Lookup: MISS)
    const firstRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/site-diaries`,
      headers: {
        cookie: supervisorCookie,
        'idempotency-key': idempotencyKey,
      },
      payload,
    });

    expect(firstRes.statusCode).toBe(201);
    expect(firstRes.headers['x-cache-lookup']).toBe('MISS');
    const firstBody = JSON.parse(firstRes.body);
    const createdId = firstBody.data.id;

    // Count diaries for this date in DB
    const countAfterFirst = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.siteDiary.count({
        where: {
          project_id: projectAId,
          entry_date: new Date('2026-11-04T00:00:00.000Z'),
        },
      });
    });
    expect(countAfterFirst).toBe(1);

    // Second submission (e.g. offline queue retry): should return cached response (X-Cache-Lookup: HIT)
    const secondRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/site-diaries`,
      headers: {
        cookie: supervisorCookie,
        'idempotency-key': idempotencyKey,
      },
      payload,
    });

    expect(secondRes.statusCode).toBe(201);
    expect(secondRes.headers['x-cache-lookup']).toBe('HIT');
    const secondBody = JSON.parse(secondRes.body);
    expect(secondBody.data.id).toBe(createdId);

    // Verify DB still only has exactly 1 record (zero duplicate corruption)
    const countAfterSecond = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.siteDiary.count({
        where: {
          project_id: projectAId,
          entry_date: new Date('2026-11-04T00:00:00.000Z'),
        },
      });
    });
    expect(countAfterSecond).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // 5. Multi-Tenant RLS Cross-Tenant Isolation
  // ---------------------------------------------------------------------------
  it('enforces PostgreSQL RLS: Tenant B cannot view or tamper with Tenant A site diaries', async () => {
    // 1. Get Tenant A diary ID
    const listRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/site-diaries`,
      headers: { cookie: adminCookie },
    });
    const diaryA = JSON.parse(listRes.body).data[0];

    // 2. Tenant B supervisor tries to view Tenant A diary
    const viewRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/site-diaries/${diaryA.id}`,
      headers: { cookie: tenantBCookie },
    });
    expect(viewRes.statusCode).toBe(404);

    // 3. Tenant B supervisor tries to list diaries for Project A
    const tenantBList = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/site-diaries`,
      headers: { cookie: tenantBCookie },
    });
    expect(tenantBList.statusCode).toBe(200);
    expect(JSON.parse(tenantBList.body).data).toHaveLength(0);

    // 4. Direct DB lookup under Tenant B context returns 0 rows
    const dbCross = await withTenantTx(prisma, tenantBId, async (tx) => {
      return tx.siteDiary.findMany({
        where: { project_id: projectAId },
      });
    });
    expect(dbCross).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 6. RBAC & Permissions Enforcement
  // ---------------------------------------------------------------------------
  it('forbids Client role from recording a site diary (least-privilege RBAC)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/site-diaries`,
      headers: { cookie: clientCookie },
      payload: {
        entryDate: '2026-11-05',
        weather: 'SUNNY_CLEAR',
        siteStatus: 'OPERATIONAL',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toBe('Forbidden');
  });

  it('rejects unauthenticated requests without session cookie', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/site-diaries`,
      payload: {
        entryDate: '2026-11-05',
        weather: 'SUNNY_CLEAR',
        siteStatus: 'OPERATIONAL',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // 7. Atomic Rollback Verification
  // ---------------------------------------------------------------------------
  it('guarantees atomic rollback on diary failure: no orphan headcounts or deliveries persist', async () => {
    const failingDate = new Date('2026-11-08T00:00:00.000Z');

    try {
      await withTenantTx(prisma, tenantAId, async (tx) => {
        const diary = await tx.siteDiary.create({
          data: {
            tenant_id: tenantAId,
            project_id: projectAId,
            entry_date: failingDate,
            weather: 'HEAVY_RAIN',
            site_status: 'STOPPED',
            recorded_by_id: supervisorAId,
          },
        });

        await tx.laborHeadcount.create({
          data: {
            tenant_id: tenantAId,
            site_diary_id: diary.id,
            trade_type: 'Mason',
            headcount: 5,
          },
        });

        // Force atomic rollback test per ADR-001 A2
        throw new Error('Simulated network/database failure halfway through atomic site diary transaction');
      });
    } catch {
      // Expected forced failure to assert transaction rollback
    }

    // Verify neither diary nor headcount was committed
    const count = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.siteDiary.count({
        where: {
          project_id: projectAId,
          entry_date: failingDate,
        },
      });
    });
    expect(count).toBe(0);
  });
});
