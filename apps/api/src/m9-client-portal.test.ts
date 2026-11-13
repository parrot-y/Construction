import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword, Prisma } from '@construction/db';
import { toDecimal } from '@construction/money';
import { enrollAllTenantUsersTx } from './test-members';

describe('Milestone M9: Client / Developer Portal Integration Test Suite', () => {
  const server = buildServer();

  let adminCookie: string;
  let clientCookie: string;
  let supervisorCookie: string;
  let tenantBCookie: string;

  let tenantAId: string;
  let projectAId: string;
  let adminAId: string;
  let sampleBoqItem1Id: string;
  let sampleBoqItem2Id: string;
  let testProjectCode: string;

  beforeAll(async () => {
    await server.ready();

    // 1. Login as Apex Builders Admin (Tenant A)
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;
    const adminBody = JSON.parse(adminRes.body);
    tenantAId = adminBody.user.tenant.id;
    adminAId = adminBody.user.id;

    // The retention-terms test asserts the standard Kenyan default schedule;
    // other suites may have configured tenant terms on this shared DB, so
    // reset to the unconfigured state for determinism.
    await prisma.tenant.update({
      where: { id: tenantAId },
      data: { retention_terms: Prisma.JsonNull },
    });

    // 2. Login as Client (Tenant A)
    const clientRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'client@apexbuilders.co.ke', password: 'Password123!' },
    });
    clientCookie = clientRes.headers['set-cookie'] as string;

    // 3. Login as Site Supervisor (Tenant A)
    const supRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'supervisor@apexbuilders.co.ke', password: 'Password123!' },
    });
    supervisorCookie = supRes.headers['set-cookie'] as string;

    // 4. Seed and Login as Tenant B (Kilimanjaro Development Ltd Admin)
    const defaultPasswordHash = await hashPassword('Password123!');
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b-m9' },
      update: {},
      create: {
        name: 'Kilimanjaro Development Ltd',
        slug: 'test-tenant-b-m9',
        currency: 'KES',
      },
    });

    const userB = await prisma.user.upsert({
      where: { email: 'admin@kilimanjarodev-m9.co.ke' },
      update: { password_hash: defaultPasswordHash, email_verified_at: new Date() },
      create: {
        email: 'admin@kilimanjarodev-m9.co.ke',
        password_hash: defaultPasswordHash,
        full_name: 'Daniel Kiptoo',
        is_active: true,
        email_verified_at: new Date(),
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

      // Seed Project B for Tenant B
      await tx.project.upsert({
        where: { tenant_id_code: { tenant_id: tenantB.id, code: 'KIL-M9-01' } },
        update: {},
        create: {
          tenant_id: tenantB.id,
          name: 'Kilimanjaro Heights Tower',
          code: 'KIL-M9-01',
          original_contract_sum: '75000000.00',
          current_approved_budget: '75000000.00',
        },
      });
    });

    const tbRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@kilimanjarodev-m9.co.ke', password: 'Password123!' },
    });
    tenantBCookie = tbRes.headers['set-cookie'] as string;

    testProjectCode = `M9-CP-${Date.now().toString().slice(-6)}`;

    // 5. Seed dedicated Project, BOQ, Costs, Variations, Diaries, and Progress for Tenant A
    await withTenantTx(prisma, tenantAId, async (tx) => {
      // 5.1 Project
      const proj = await tx.project.create({
        data: {
          tenant_id: tenantAId,
          code: testProjectCode,
          name: `Riverside Commercial Plaza ${testProjectCode}`,
          description: 'Prime commercial plaza development in Riverside, Nairobi',
          location: 'Riverside Drive, Nairobi',
          nca_project_no: 'NCA-PRJ-2026-0891',
          original_contract_sum: '45000000.00',
          current_approved_budget: '45000000.00',
          status: 'ACTIVE',
          start_date: new Date('2026-01-15T00:00:00.000Z'),
          target_end_date: new Date('2026-12-15T00:00:00.000Z'),
        },
      });
      projectAId = proj.id;
      await enrollAllTenantUsersTx(tx, tenantAId, projectAId);

      // 5.2 BOQ Baseline
      const boq = await tx.bOQ.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          version: 1,
          total_amount: '45000000.00',
          status: 'ACTIVE',
        },
      });

      const section1 = await tx.bOQSection.create({
        data: {
          tenant_id: tenantAId,
          boq_id: boq.id,
          order_idx: 1,
          title: 'Section 1: Substructure',
          total_amount: '15000000.00',
        },
      });

      const item1 = await tx.bOQItem.create({
        data: {
          tenant_id: tenantAId,
          section_id: section1.id,
          item_code: '1.1.1',
          description: 'Mass excavation in rock and earth for basement levels',
          unit: 'CM',
          quantity: '500.0000',
          unit_rate: '4000.0000',
          total_amount: '2000000.00',
        },
      });
      sampleBoqItem1Id = item1.id;

      const section2 = await tx.bOQSection.create({
        data: {
          tenant_id: tenantAId,
          boq_id: boq.id,
          order_idx: 2,
          title: 'Section 2: Reinforced Concrete Frame',
          total_amount: '30000000.00',
        },
      });

      const item2 = await tx.bOQItem.create({
        data: {
          tenant_id: tenantAId,
          section_id: section2.id,
          item_code: '2.1.1',
          description: 'Vibrated reinforced concrete class 30/20 in columns and beams',
          unit: 'CM',
          quantity: '300.0000',
          unit_rate: '25000.0000',
          total_amount: '7500000.00',
        },
      });
      sampleBoqItem2Id = item2.id;

      // 5.3 Cost Entries (APPROVED: 3,000,000.00 + 1,500,000.00 = 4,500,000.00; PENDING: 500,000.00)
      await tx.costEntry.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          boq_item_id: sampleBoqItem1Id,
          cost_category: 'MATERIAL',
          amount: '3000000.00',
          vendor_name: 'Bamburi Cement Ltd',
          description: 'Foundation blinding and high-strength Portland cement',
          status: 'APPROVED',
          created_by_id: adminAId,
        },
      });

      await tx.costEntry.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          boq_item_id: sampleBoqItem1Id,
          cost_category: 'LABOR',
          amount: '1500000.00',
          vendor_name: 'Nairobi Skilled Labor Syndicate',
          description: 'Artisan steel fixers and excavation crew wages',
          status: 'APPROVED',
          created_by_id: adminAId,
        },
      });

      await tx.costEntry.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          boq_item_id: sampleBoqItem2Id,
          cost_category: 'PLANT',
          amount: '500000.00',
          vendor_name: 'CAT Plant Hire Kenya',
          description: 'Excavator and mobile concrete pump hire (pending verification)',
          status: 'PENDING',
          created_by_id: adminAId,
        },
      });

      // 5.4 Variation Orders
      // Variation 1: APPROVED (+900,000.00)
      await tx.variationOrder.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          variation_no: 1,
          title: 'Deepening of foundation pad footings due to fractured bedrock',
          reason: 'Geotechnical engineering recommendation following test pit inspection',
          status: 'APPROVED',
          net_amount: '900000.00',
          time_extension_days: 14,
          approved_at: new Date(),
          items: {
            create: [
              {
                tenant_id: tenantAId,
                boq_item_id: sampleBoqItem1Id,
                description: 'Additional excavation in hard rock strata',
                unit: 'CM',
                quantity: '100.0000',
                unit_rate: '9000.0000',
                total_amount: '900000.00',
              },
            ],
          },
        },
      });

      // Variation 2: OWNER_REVIEW (+450,000.00) - Awaiting client decision (ADR-010)
      await tx.variationOrder.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          variation_no: 2,
          title: 'High-performance curtain wall glazing specification enhancement',
          reason: 'Architectural acoustic enhancement for street-facing facade',
          status: 'OWNER_REVIEW',
          net_amount: '450000.00',
          time_extension_days: 7,
          items: {
            create: [
              {
                tenant_id: tenantAId,
                description: 'Acoustic double-glazed laminated glass panels',
                unit: 'SM',
                quantity: '50.0000',
                unit_rate: '9000.0000',
                total_amount: '450000.00',
              },
            ],
          },
        },
      });

      // Variation 3: OWNER_REVIEW (+320,000.00) - Awaiting client approval (ADR-010)
      await tx.variationOrder.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          variation_no: 3,
          title: 'Sub-basement waterproofing bentonite membrane addition',
          reason: 'High groundwater table detected during seasonal rains',
          status: 'OWNER_REVIEW',
          net_amount: '320000.00',
          time_extension_days: 5,
          items: {
            create: [
              {
                tenant_id: tenantAId,
                description: 'Self-adhering bentonite waterproofing sheet',
                unit: 'SM',
                quantity: '80.0000',
                unit_rate: '4000.0000',
                total_amount: '320000.00',
              },
            ],
          },
        },
      });

      // Variation 4: REJECTED (+120,000.00)
      await tx.variationOrder.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          variation_no: 4,
          title: 'Temporary timber hoarding relocation',
          reason: 'Contractor site boundary adjustment',
          status: 'REJECTED',
          net_amount: '120000.00',
          time_extension_days: 0,
        },
      });

      // 5.5 Site Diaries & Geotagged Photo Evidence
      const diary1 = await tx.siteDiary.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          entry_date: new Date('2026-02-01T00:00:00.000Z'),
          weather: 'SUNNY_CLEAR',
          site_status: 'OPERATIONAL',
          general_notes: 'Excavation completed to formation level; structural blinding commenced.',
          recorded_by_id: adminAId,
        },
      });

      await tx.sitePhoto.create({
        data: {
          tenant_id: tenantAId,
          site_diary_id: diary1.id,
          storage_key: 'evidence/m9-cp-2026/foundation_blinding_01.jpg',
          caption: 'Foundation blinding concrete poured and cured at grid line A-D',
          client_visible: true,
          taken_at: new Date('2026-02-01T10:30:00.000Z'),
          gps_latitude: -1.286389,
          gps_longitude: 36.817223,
        },
      });

      const diary2 = await tx.siteDiary.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          entry_date: new Date('2026-02-15T00:00:00.000Z'),
          weather: 'PARTLY_CLOUDY',
          site_status: 'OPERATIONAL',
          general_notes: 'Column starter rebar placed and inspected by resident engineer.',
          recorded_by_id: adminAId,
        },
      });

      await tx.sitePhoto.create({
        data: {
          tenant_id: tenantAId,
          site_diary_id: diary2.id,
          storage_key: 'evidence/m9-cp-2026/column_rebar_inspection.jpg',
          caption: 'Column starter bar alignment verified against structural drawings',
          client_visible: true,
          taken_at: new Date('2026-02-15T14:15:00.000Z'),
          gps_latitude: -1.286500,
          gps_longitude: 36.817350,
        },
      });

      // 5.6 Physical Progress Milestones
      const progress1 = await tx.progressRecord.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          record_date: new Date('2026-02-01T00:00:00.000Z'),
          overall_progress: '0.0500',
          notes: 'Milestone 1: Substructure excavation 50% completed',
        },
      });

      await tx.progressItem.create({
        data: {
          tenant_id: tenantAId,
          progress_record_id: progress1.id,
          boq_item_id: sampleBoqItem1Id,
          completed_quantity: '250.0000',
          completion_pct: '0.5000',
        },
      });

      const progress2 = await tx.progressRecord.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          record_date: new Date('2026-02-15T00:00:00.000Z'),
          overall_progress: '0.1200',
          notes: 'Milestone 2: Substructure blinding 100% complete; column rebar underway',
        },
      });

      await tx.progressItem.create({
        data: {
          tenant_id: tenantAId,
          progress_record_id: progress2.id,
          boq_item_id: sampleBoqItem1Id,
          completed_quantity: '500.0000',
          completion_pct: '1.0000',
        },
      });

      await tx.progressItem.create({
        data: {
          tenant_id: tenantAId,
          progress_record_id: progress2.id,
          boq_item_id: sampleBoqItem2Id,
          completed_quantity: '60.0000',
          completion_pct: '0.2000',
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 1: Retrieval of client portal data for assigned CLIENT user
  // ---------------------------------------------------------------------------
  it('retrieves complete client portal data for assigned client user with 200 OK', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeDefined();
    expect(body.data.project).toBeDefined();
    expect(body.data.financials).toBeDefined();
    expect(body.data.progress).toBeDefined();
    expect(body.data.photo_evidence).toBeDefined();
    expect(body.data.timeline).toBeDefined();
    expect(body.data.pending_variations).toBeDefined();
    expect(body.data.retention_terms).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Exact decimal financial aggregation
  // ---------------------------------------------------------------------------
  it('computes exact decimal financial aggregation without floating point errors', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const { financials } = body.data;

    // 1. Original Agreed Budget = 45,000,000.00
    expect(financials.original_agreed_budget).toBe('45000000.00');

    // 2. Approved Variations Total = +900,000.00 (from variation 1 only)
    expect(financials.approved_variations_total).toBe('900000.00');

    // 3. Current Approved Budget = 45,000,000.00 + 900,000.00 = 45,900,000.00
    expect(financials.current_approved_budget).toBe('45900000.00');

    // 4. Total Spent To Date = 3,000,000.00 + 1,500,000.00 = 4,500,000.00 (APPROVED CostEntries only)
    expect(financials.total_spent_to_date).toBe('4500000.00');

    // 5. Remaining Balance = 45,900,000.00 - 4,500,000.00 = 41,400,000.00
    expect(financials.remaining_balance).toBe('41400000.00');

    // 6. Decimal Invariant Verification: current_approved_budget - total_spent = remaining_balance
    const currentBudgetDec = toDecimal(financials.current_approved_budget);
    const spentDec = toDecimal(financials.total_spent_to_date);
    const remainingDec = toDecimal(financials.remaining_balance);
    expect(currentBudgetDec.minus(spentDec).equals(remainingDec)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Budget used percentage formatted to 1 decimal place
  // ---------------------------------------------------------------------------
  it('formats budget used percentage as a number with 1 decimal place', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const { financials } = body.data;

    // 4,500,000.00 / 45,900,000.00 * 100 = 9.8039... -> 9.8%
    expect(typeof financials.budget_used_percentage).toBe('number');
    expect(financials.budget_used_percentage).toBe(9.8);
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Geotagged photo evidence with Nairobi GPS coordinates
  // ---------------------------------------------------------------------------
  it('returns verified photo evidence array with Nairobi GPS coordinates, captions, weather, and recorder', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const photos = body.data.photo_evidence;

    expect(Array.isArray(photos)).toBe(true);
    expect(photos.length).toBe(2);

    const blindingPhoto = photos.find((p: any) => p.caption.includes('Foundation blinding'));
    expect(blindingPhoto).toBeDefined();
    expect(blindingPhoto.photo_url).toContain('foundation_blinding_01.jpg');
    // Nairobi latitude ~ -1.286389, longitude ~ 36.817223
    expect(blindingPhoto.latitude).toBeCloseTo(-1.286389, 4);
    expect(blindingPhoto.longitude).toBeCloseTo(36.817223, 4);
    expect(blindingPhoto.weather).toBe('SUNNY_CLEAR');
    expect(blindingPhoto.recorded_by_name).toBeDefined();
    expect(blindingPhoto.recorded_by_name).toContain('Mwangi Karanja');

    const rebarPhoto = photos.find((p: any) => p.caption.includes('Column starter bar'));
    expect(rebarPhoto).toBeDefined();
    expect(rebarPhoto.latitude).toBeCloseTo(-1.286500, 4);
    expect(rebarPhoto.longitude).toBeCloseTo(36.817350, 4);
    expect(rebarPhoto.weather).toBe('PARTLY_CLOUDY');
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Milestone timeline items ordered chronologically
  // ---------------------------------------------------------------------------
  it('orders milestone timeline items chronologically with section code and inspector notes', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const timeline = body.data.timeline;

    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.length).toBeGreaterThanOrEqual(3);

    // Verify chronological order (oldest first)
    for (let i = 1; i < timeline.length; i++) {
      const prevTime = new Date(timeline[i - 1].recorded_at).getTime();
      const currTime = new Date(timeline[i].recorded_at).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }

    // Verify properties of timeline items
    const excavationStep = timeline[0];
    expect(excavationStep.percentage).toBe(50.0);
    expect(excavationStep.notes).toContain('Milestone 1');
    expect(excavationStep.item_description).toContain('Mass excavation');
    expect(excavationStep.section_code).toBeDefined();

    const concreteStep = timeline[timeline.length - 1];
    expect(concreteStep.percentage).toBe(20.0);
    expect(concreteStep.item_description).toContain('reinforced concrete');
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Pending variations count and list
  // ---------------------------------------------------------------------------
  it('lists only OWNER_REVIEW variations awaiting client decision (ADR-010)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const { pending_variations } = body.data;

    expect(pending_variations.count).toBe(2);
    expect(pending_variations.items).toHaveLength(2);

    const statuses = pending_variations.items.map((v: any) => v.status);
    expect(statuses).toEqual(['OWNER_REVIEW', 'OWNER_REVIEW']);
    expect(statuses).not.toContain('APPROVED');
    expect(statuses).not.toContain('REJECTED');
    expect(statuses).not.toContain('PM_REVIEW');

    const v2 = pending_variations.items.find((v: any) => v.variation_no === 2);
    expect(v2.net_amount).toBe('450000.00');
    expect(v2.time_extension_days).toBe(7);

    const v3 = pending_variations.items.find((v: any) => v.variation_no === 3);
    expect(v3.net_amount).toBe('320000.00');
    expect(v3.time_extension_days).toBe(5);
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Strict neutral language assertion
  // ---------------------------------------------------------------------------
  it('guarantees strictly neutral language without accusatory words across entire response payload', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    const rawResponseBody = res.body;

    // ADR-001 / ADR-005 Invariant: Zero inflammatory words in client-facing portal
    const inflammatoryWordsRegex = /(fraud|theft|stole|embezzle|corrupt|cheat|overbilled)/i;
    expect(rawResponseBody).not.toMatch(inflammatoryWordsRegex);

    const body = JSON.parse(rawResponseBody);
    expect(body.data.progress.health_notice).toBeDefined();
    expect(body.data.progress.health_notice).not.toMatch(inflammatoryWordsRegex);
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Kenyan Standard Retention Terms
  // ---------------------------------------------------------------------------
  it('provides Kenyan Standard Retention terms with 10% deduction and 5% cap', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const { retention_terms } = body.data;

    expect(retention_terms.interim_deduction_rate).toBe('10%');
    expect(retention_terms.max_cap_rate).toBe('5%');

    // 5% of original contract sum (45,000,000.00) = 2,250,000.00
    expect(retention_terms.max_cap_amount).toBe('2250000.00');

    expect(Array.isArray(retention_terms.release_schedule)).toBe(true);
    expect(retention_terms.release_schedule).toHaveLength(2);
    expect(retention_terms.release_schedule[0].milestone).toBe('Practical Completion');
    expect(retention_terms.release_schedule[0].percentage).toBe('50%');
    expect(retention_terms.release_schedule[1].milestone).toBe('Defects Liability Period');
    expect(retention_terms.release_schedule[1].percentage).toBe('50%');
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Project metadata information
  // ---------------------------------------------------------------------------
  it('returns comprehensive project metadata for client visibility', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const { project } = body.data;

    expect(project.id).toBe(projectAId);
    expect(project.name).toBe(`Riverside Commercial Plaza ${testProjectCode}`);
    expect(project.code).toBe(testProjectCode);
    expect(project.location).toBe('Riverside Drive, Nairobi');
    expect(project.nca_registration_no).toBe('NCA-PRJ-2026-0891');
    expect(project.start_date).toBe('2026-01-15');
    expect(project.expected_completion_date).toBe('2026-12-15');
  });

  // ---------------------------------------------------------------------------
  // TEST 10: Progress health status and variance calculation
  // ---------------------------------------------------------------------------
  it('calculates physical progress percentage, variance delta, and health status', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const { progress, financials } = body.data;

    // Latest progress overall_progress = 0.1200 (12.0%)
    expect(progress.physical_progress_percentage).toBe(12.0);

    // Variance delta = budget_used_percentage (9.8%) - physical_progress_percentage (12.0%) = -2.2%
    expect(progress.variance_delta).toBeCloseTo(financials.budget_used_percentage - 12.0, 1);

    // Because cost consumption is behind physical progress, status is ON_TRACK
    expect(progress.health_status).toBe('ON_TRACK');
    expect(progress.health_notice).toBe('Expenditure is aligned with recorded physical progress.');
  });

  // ---------------------------------------------------------------------------
  // TEST 11: RLS multi-tenant isolation (Tenant B cannot access Tenant A's portal)
  // ---------------------------------------------------------------------------
  it('enforces PostgreSQL RLS multi-tenant isolation: Tenant B receives 404 for Tenant A project', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: tenantBCookie },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Project not found');
  });

  // ---------------------------------------------------------------------------
  // TEST 12: Role permission enforcement: Site Supervisor forbidden, Client allowed
  // ---------------------------------------------------------------------------
  it('forbids Site Supervisor role (403 Forbidden) while permitting Client role (200 OK)', async () => {
    // 1. Site Supervisor attempts access -> 403 Forbidden
    const supervisorRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: supervisorCookie },
    });

    expect(supervisorRes.statusCode).toBe(403);
    const supBody = JSON.parse(supervisorRes.body);
    expect(supBody.error).toBe('Forbidden');
    expect(supBody.message).toContain('Site supervisors are not permitted');

    // 2. Client attempts access -> 200 OK
    const clientRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(clientRes.statusCode).toBe(200);

    // 3. Admin attempts access -> 200 OK
    const adminAccessRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/client-portal`,
      headers: { cookie: adminCookie },
    });

    expect(adminAccessRes.statusCode).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // TEST 13: 404 for non-existent project UUID
  // ---------------------------------------------------------------------------
  it('returns 404 Not Found for non-existent project UUID', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${fakeUuid}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Project not found');
  });
});
