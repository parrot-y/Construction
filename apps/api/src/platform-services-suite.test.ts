import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { enrollAllTenantUsers } from './test-members';

describe('Milestones M22, M23 & M24: Platform Services & Site Telematics Suite', () => {
  let app: FastifyInstance;
  let authCookie: string;
  let testTenantId: string;
  let testProjectId: string;
  let testEquipmentId: string;
  let testLaborerId: string;
  let testDeviceToken: string;

  const testDeviceImei = `86901205${Date.now().toString().slice(-7)}`;
  const testWorkerCode = `WKR-${Date.now().toString().slice(-4)}`;
  const testNationalId = `ID-${Date.now().toString().slice(-6)}`;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // Retrieve seeded tenant (global lookup)
    const tenant = await prisma.tenant.findFirst({
      where: { name: 'Apex Builders Kenya Ltd' },
    });
    if (!tenant) throw new Error('Seeded tenant Apex Builders Kenya Ltd not found');
    testTenantId = tenant.id;

    // Login as Company Admin / PM
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(loginRes.statusCode).toBe(200);
    authCookie = loginRes.headers['set-cookie'] as string;

    // Create an active test project
    const projectRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: authCookie },
      payload: {
        name: 'Platform Telematics Project Test',
        code: `TEL-${Date.now().toString().slice(-4)}`,
        location: 'Upper Hill, Nairobi',
        originalContractSum: 150000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    testProjectId = JSON.parse(projectRes.body).data.id;
    await enrollAllTenantUsers(testProjectId);

    // Create test plant equipment
    const equipRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${testProjectId}/equipment`,
      headers: { cookie: authCookie },
      payload: {
        equipmentCode: `EXC-${Date.now().toString().slice(-3)}`,
        name: 'CAT 330 GC Hydraulic Excavator',
        equipmentType: 'EXCAVATOR',
        ownershipType: 'OWNED',
        ratePerUnitKes: '7500.00',
        rateUnit: 'PER_HOUR',
        registrationNo: 'KDF 999X',
        supplierName: 'Apex Fleet Logistics',
        currentHoursMeter: '1200.00',
      },
    });
    expect(equipRes.statusCode).toBe(201);
    testEquipmentId = JSON.parse(equipRes.body).equipment.id;

    // Create test site laborer
    const laborerRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${testProjectId}/laborers`,
      headers: { cookie: authCookie },
      payload: {
        workerCode: testWorkerCode,
        fullName: 'Kiprono Koech',
        nationalIdNo: testNationalId,
        phoneNumber: '+254711223344',
        tradeCategory: 'MASON',
        skillLevel: 'ARTISAN_FUNDI',
        dailyRateKes: '1600.00',
      },
    });
    expect(laborerRes.statusCode).toBe(201);
    testLaborerId = JSON.parse(laborerRes.body).laborer.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ===========================================================================
  // MILESTONE M22: SAFARICOM DARAJA M-PESA SUBSCRIPTION BILLING (ADR-006)
  // ===========================================================================
  describe('Milestone M22: Safaricom Daraja M-Pesa Subscription Billing (ADR-006)', () => {
    let capturedCheckoutRequestId: string;

    it('should retrieve initial tenant subscription status (TRIAL/PROJECT_TIER)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/subscription-status',
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.tenantId).toBe(testTenantId);
      expect(body.activePlan).toBeDefined();
      expect(body.subscriptionState).toBeDefined();
    });

    it('should initiate Lipa Na M-Pesa Online (STK Push) for PORTFOLIO_TIER', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/mpesa-express',
        headers: { cookie: authCookie },
        payload: {
          phoneNumber: '0712345678',
          planCode: 'PORTFOLIO_TIER',
          amount: '25000.00',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.responseCode).toBe('0');
      expect(body.checkoutRequestId).toMatch(/^ws_CO_/);
      expect(body.customerMessage).toContain('SIMULATED STK push to 254712345678');
      capturedCheckoutRequestId = body.checkoutRequestId;
    });

    it('should reject unauthenticated M-Pesa callback with 401 Unauthorized (C1 hardening)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/mpesa-callback',
        payload: {
          MerchantRequestID: 'MR_TEST_FORGED',
          CheckoutRequestID: capturedCheckoutRequestId,
          ResultCode: 0,
          ResultDesc: 'Success',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should ignore spoofed tenantId and resolve tenant securely from database transaction (C1 & 2b hardening)', async () => {
      const attackerTenantId = '00000000-0000-0000-0000-000000000000';
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/mpesa-callback?tenantId=${attackerTenantId}`,
        headers: {
          'x-mpesa-webhook-token': 'mjengo-daraja-webhook-secret-production',
        },
        payload: {
          MerchantRequestID: 'MR_TEST_VALID',
          CheckoutRequestID: capturedCheckoutRequestId,
          ResultCode: 0,
          ResultDesc: 'Success',
          MpesaReceiptNumber: 'NL12345678',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).tenantId).toBe(testTenantId);
    });

    it('should return 404 when processing callback for unknown checkout request ID', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/mpesa-callback?tenantId=${testTenantId}`,
        headers: {
          'x-mpesa-webhook-token': 'mjengo-daraja-webhook-secret-production',
        },
        payload: {
          MerchantRequestID: 'MR_TEST_UNKNOWN',
          CheckoutRequestID: 'ws_CO_NONEXISTENT_ID_99999',
          ResultCode: 0,
          ResultDesc: 'Success',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should successfully process inbound Daraja M-Pesa confirmation callback and activate tier', async () => {
      const mpesaReceipt = `NL${Date.now().toString().slice(-8)}`;

      const callbackRes = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/mpesa-callback?tenantId=${testTenantId}`,
        headers: {
          'x-mpesa-webhook-token': 'mjengo-daraja-webhook-secret-production',
        },
        payload: {
          MerchantRequestID: 'MR_TEST_VALID',
          CheckoutRequestID: capturedCheckoutRequestId,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          MpesaReceiptNumber: mpesaReceipt,
        },
      });

      expect(callbackRes.statusCode).toBe(200);
      const cbBody = JSON.parse(callbackRes.body);
      expect(cbBody.status).toBe('SUCCESS');
      expect(cbBody.receiptNumber).toBe(mpesaReceipt);

      // Verify subscription status is now ACTIVE with PORTFOLIO_TIER
      const statusRes = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/subscription-status',
        headers: { cookie: authCookie },
      });

      expect(statusRes.statusCode).toBe(200);
      const statusBody = JSON.parse(statusRes.body);
      expect(statusBody.subscriptionState).toBe('ACTIVE');
      expect(statusBody.activePlan).toBe('PORTFOLIO_TIER');
      expect(statusBody.monthlyFeeKes).toBe('25000.00');
      expect(statusBody.maxAllowedProjects).toBe(999);
      expect(statusBody.lastPaymentRef).toBe(mpesaReceipt);
    });

    it('should list billing transactions for tenant', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/transactions',
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.totalTransactions).toBeGreaterThanOrEqual(1);
      expect(body.transactions.some((t: any) => t.planCode === 'PORTFOLIO_TIER')).toBe(true);
    });
  });

  // ===========================================================================
  // MILESTONE M23: PROJECT GEOFENCING & BIOMETRIC/GPS CLOCK-IN ENGINE
  // ===========================================================================
  describe('Milestone M23: Project Geofencing & Biometric/GPS Mobile Clock-In Engine', () => {
    it('should create an active project geofence boundary (150m radius)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/geofences`,
        headers: { cookie: authCookie },
        payload: {
          geofenceName: 'Upper Hill Site Gate & Perimeter',
          centerLatitude: '-1.292100',
          centerLongitude: '36.821900',
          radiusMeters: '150.00',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.geofenceName).toBe('Upper Hill Site Gate & Perimeter');
      expect(body.radiusMeters).toBe('150.00');
      expect(body.isActive).toBe(true);
    });

    it('should list project geofences', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/geofences`,
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.geofences.length).toBeGreaterThanOrEqual(1);
      expect(body.geofences[0].centerLatitude).toBe('-1.292100');
    });

    it('should record worker clock-in WITHIN geofence boundary (~7m distance)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/clock-in`,
        headers: { cookie: authCookie },
        payload: {
          laborerId: testLaborerId,
          clockType: 'CLOCK_IN',
          capturedLatitude: '-1.292150',
          capturedLongitude: '36.821920',
          photoSelfieUrl: 'https://storage.example.com/selfies/wkr999_in.jpg',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.workerName).toBe('Kiprono Koech');
      expect(body.clockType).toBe('CLOCK_IN');
      expect(body.verificationStatus).toBe('WITHIN_GEOFENCE');
      expect(parseFloat(body.calculatedDistanceMeters)).toBeLessThan(50);
    });

    it('should record worker clock-in OUTSIDE geofence boundary and flag violation (~1.2km distance)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/clock-in`,
        headers: { cookie: authCookie },
        payload: {
          laborerId: testLaborerId,
          clockType: 'CLOCK_OUT',
          capturedLatitude: '-1.300000',
          capturedLongitude: '36.830000',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.verificationStatus).toBe('OUTSIDE_GEOFENCE_FLAGGED');
      expect(parseFloat(body.calculatedDistanceMeters)).toBeGreaterThan(500);
    });

    it('should list worker clock events and breakdown within vs outside geofence', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/clock-events`,
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalEvents).toBeGreaterThanOrEqual(2);
      expect(body.summary.withinGeofence).toBeGreaterThanOrEqual(1);
      expect(body.summary.outsideGeofence).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // MILESTONE M24: PLANT GPS TELEMATICS & REMOTE FUEL SIPHONING DETECTION
  // ===========================================================================
  describe('Milestone M24: Direct Plant GPS Telematics & Remote Fuel Siphoning Anomaly Detection', () => {
    it('should register a telematics device to excavator equipment', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/telematics-devices`,
        headers: { cookie: authCookie },
        payload: {
          equipmentId: testEquipmentId,
          deviceImei: testDeviceImei,
          protocol: 'CANBUS',
          simPhoneNumber: '+254711998877',
          calibrationTankCapacityLiters: '400.00',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.deviceImei).toBe(testDeviceImei);
      expect(body.calibrationTankCapacityLiters).toBe('400.00');
      expect(body.status).toBe('ONLINE');
      testDeviceToken = body.deviceToken;
      expect(testDeviceToken).toBeDefined();
    });

    it('should reject duplicate registration of same device IMEI', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/telematics-devices`,
        headers: { cookie: authCookie },
        payload: {
          equipmentId: testEquipmentId,
          deviceImei: testDeviceImei,
          protocol: 'CANBUS',
          calibrationTankCapacityLiters: '400.00',
        },
      });

      expect(res.statusCode).toBe(409);
    });

    it('should reject unauthenticated telematics ping without token with 401 Unauthorized (C3 hardening)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telematics/ping',
        headers: {
          'x-tenant-id': testTenantId,
        },
        payload: {
          deviceImei: testDeviceImei,
          latitude: '-1.292100',
          longitude: '36.821900',
          engineStatus: 'RUNNING',
          engineRpm: 1800,
          cumulativeEngineSeconds: 36000,
          fuelLevelPercent: '80.00',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should ingest normal telematics ping (engine running, 80% fuel = 320L)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telematics/ping',
        headers: {
          'x-device-token': testDeviceToken,
          'x-tenant-id': testTenantId,
        },
        payload: {
          deviceImei: testDeviceImei,
          latitude: '-1.292100',
          longitude: '36.821900',
          engineStatus: 'RUNNING',
          engineRpm: 1800,
          cumulativeEngineSeconds: 36000,
          fuelLevelPercent: '80.00',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.calculatedFuelLiters).toBe('320.00');
      expect(body.isSiphoningEvent).toBe(false);
    });

    it('should detect sudden diesel siphoning anomaly (>30L drop while STOPPED) and generate emergency alert', async () => {
      // Tank was at 320L (80%). Next ping reports 70% = 280L (40L drop!) while STOPPED.
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telematics/ping',
        headers: {
          'x-device-token': testDeviceToken,
          'x-tenant-id': testTenantId,
        },
        payload: {
          deviceImei: testDeviceImei,
          latitude: '-1.292100',
          longitude: '36.821900',
          engineStatus: 'STOPPED',
          engineRpm: 0,
          cumulativeEngineSeconds: 36000,
          fuelLevelPercent: '70.00',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.calculatedFuelLiters).toBe('280.00');
      expect(body.isSiphoningEvent).toBe(true);

      // Verify that an automated SiteAlertNotification of type DIESEL_DISCREPANCY_FLAG was dispatched (2e neutral wording)
      const alert = await withTenantTx(prisma, testTenantId, (tx) =>
        tx.siteAlertNotification.findFirst({
          where: {
            project_id: testProjectId,
            alert_type: { in: ['DIESEL_DISCREPANCY_FLAG', 'DIESEL_SIPHONING_FLAG'] },
          },
        })
      );

      expect(alert).toBeDefined();
      expect(alert?.message_body).toContain('Rapid fuel level drop of 40.0L detected');
      expect(alert?.delivery_channel).toBe('WHATSAPP');
    });

    it('should list telematics pings and breakdown siphoning events for project', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/telematics-pings`,
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalPings).toBeGreaterThanOrEqual(2);
      expect(body.summary.siphoningEvents).toBeGreaterThanOrEqual(1);
      expect(body.pings.some((p: any) => p.isSiphoningEvent === true)).toBe(true);
    });
  });

  // ===========================================================================
  // 4. MILESTONE M25: REBAR TAKEOFF & BS 8666 BAR BENDING SCHEDULES (BBS)
  // ===========================================================================
  describe('Milestone M25: Rebar Takeoff & BS 8666 Bar Bending Schedules (BBS)', () => {
    let createdScheduleId: string;

    it('should create Bar Bending Schedule with calculated cut length, total weights, and 12m stock commercial bar count', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/bar-bending-schedules`,
        headers: { cookie: authCookie },
        payload: {
          scheduleNumber: 'BBS-SUB-001',
          elementName: 'Substructure Foundation Footings & Ground Beams',
          drawingRef: 'STR/DWG/04-REV2',
          steelGrade: 'HIGH_YIELD_460',
          items: [
            {
              memberTag: 'Footing F1 (1500x1500x400)',
              barMark: '01',
              barType: 'Y16',
              numberOfMembers: 12,
              barsPerMember: 8, // 96 bars
              shapeCode: '00', // straight
              dimensionAMm: 1400, // 1.40m
            },
            {
              memberTag: 'Ground Beam GB1',
              barMark: '02',
              barType: 'Y20',
              numberOfMembers: 4,
              barsPerMember: 6, // 24 bars
              shapeCode: '21', // L-Bar (A + B)
              dimensionAMm: 5500, // 5.50m
              dimensionBMm: 500,  // 0.50m => 6.00m
            },
            {
              memberTag: 'Column Starter Bars C1',
              barMark: '03',
              barType: 'Y8',
              numberOfMembers: 12,
              barsPerMember: 14, // 168 links
              shapeCode: '51', // Rectangular stirrup: 2*(200+350) + 24*8 = 1100 + 192 = 1292mm = 1.292m
              dimensionAMm: 200,
              dimensionBMm: 350,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdScheduleId = body.id;
      expect(body.scheduleNumber).toBe('BBS-SUB-001');
      expect(body.itemCount).toBe(3);
      expect(body.status).toBe('DRAFT');
      expect(Number(body.totalTonnage)).toBeGreaterThan(0.5);

      // Verify individual bar calculations
      const item01 = body.items.find((i: any) => i.barMark === '01');
      expect(item01.cutLengthMeters).toBe('1.400');
      expect(item01.totalBars).toBe(96);
      expect(item01.totalLengthMeters).toBe('134.400');
      expect(item01.unitWeightKgPerM).toBe('1.579'); // Y16 unit weight
      expect(item01.standardBarsNeeded12m).toBe(12); // ceil(134.4 / 12) = 12

      const item02 = body.items.find((i: any) => i.barMark === '02');
      expect(item02.cutLengthMeters).toBe('6.000');
      expect(item02.totalBars).toBe(24);
      expect(item02.unitWeightKgPerM).toBe('2.466'); // Y20 unit weight
    });

    it('should list Bar Bending Schedules for project and calculate summary tonnage breakdown by bar size', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/bar-bending-schedules`,
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalSchedules).toBeGreaterThanOrEqual(1);
      expect(Number(body.summary.totalProjectTonnage)).toBeGreaterThan(0.5);
      expect(body.summary.tonnageByType['Y16']).toBeDefined();
      expect(body.summary.tonnageByType['Y20']).toBeDefined();
      expect(body.summary.tonnageByType['Y8']).toBeDefined();
    });

    it('should retrieve single Bar Bending Schedule cutting list details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/bar-bending-schedules/${createdScheduleId}`,
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(createdScheduleId);
      expect(body.items.length).toBe(3);
      expect(body.items[0].dimensions.aMm).toBeDefined();
    });

    it('should update schedule status to APPROVED_FOR_CUTTING', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${testProjectId}/bar-bending-schedules/${createdScheduleId}/status`,
        headers: { cookie: authCookie },
        payload: { status: 'APPROVED_FOR_CUTTING' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe('APPROVED_FOR_CUTTING');
    });
  });

  // ===========================================================================
  // 5. MILESTONE M26: SAFARICOM DARAJA B2C BULK WAGES & RETENTIONS
  // ===========================================================================
  describe('Milestone M26: Safaricom Daraja B2C Bulk Wages & Retention Disbursements', () => {
    const testIdempotencyKey = `IDEM-B2C-${Date.now()}`;
    let conversationId: string;

    it('should initiate Safaricom Daraja B2C disbursement in PENDING_APPROVAL state (maker-checker, simulated dispatch)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/b2c-disburse`,
        headers: { cookie: authCookie },
        payload: {
          disbursementType: 'CASUAL_LABOR_WAGE',
          recipientPhone: '+254712345678',
          recipientName: 'Kariuki Mwangi (Site Mason)',
          amount: '12500.00',
          remarks: 'Muster Roll Week 44 Payout',
          idempotencyKey: testIdempotencyKey,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      conversationId = body.conversationId;
      expect(body.status).toBe('PENDING_APPROVAL');
      expect(body.amount).toBe('12500.00');
      expect(body.isIdempotentReplay).toBe(false);
      expect(body.simulated).toBe(true);
      expect(body.requiresApproval).toBe(true);
    });

    it('maker-checker: initiator cannot self-approve; a different COST_APPROVE user can', async () => {
      const list = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/b2c-disbursements`,
        headers: { cookie: authCookie },
      });
      const pending = JSON.parse(list.body).disbursements.find((d: any) => d.status === 'PENDING_APPROVAL');
      expect(pending).toBeTruthy();

      // Same user (maker) -> 403
      const selfApprove = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/b2c-disbursements/${pending.id}/approve`,
        headers: { cookie: authCookie },
      });
      expect(selfApprove.statusCode).toBe(403);

      // Different authorized user (PM/QS) -> approves
      const qsLogin = await app.inject({
        method: 'POST', url: '/api/v1/auth/login',
        payload: { email: 'qs@apexbuilders.co.ke', password: 'Password123!' },
      });
      const qsCookie = qsLogin.headers['set-cookie'] as string;
      const approve = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/b2c-disbursements/${pending.id}/approve`,
        headers: { cookie: qsCookie },
      });
      expect(approve.statusCode).toBe(200);
      expect(JSON.parse(approve.body).data.status).toBe('PENDING');
      expect(JSON.parse(approve.body).data.simulated).toBe(true);
    });

    it('should handle idempotent replay for identical B2C idempotencyKey', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/b2c-disburse`,
        headers: { cookie: authCookie },
        payload: {
          disbursementType: 'CASUAL_LABOR_WAGE',
          recipientPhone: '+254712345678',
          recipientName: 'Kariuki Mwangi (Site Mason)',
          amount: '12500.00',
          remarks: 'Muster Roll Week 44 Payout',
          idempotencyKey: testIdempotencyKey,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.isIdempotentReplay).toBe(true);
      // status reflects the existing transaction (approved to PENDING by the maker-checker test above)
      expect(['PENDING_APPROVAL', 'PENDING']).toContain(body.status);
      expect(body.amount).toBe('12500.00');
    });

    it('should reject unauthenticated B2C callback with 401 Unauthorized (C1 hardening)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/mpesa-b2c-callback',
        payload: {
          ConversationID: conversationId,
          OriginatorConversationID: 'AGY-TEST-ORIG-01',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          TransactionID: 'SKL99887766',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should ignore spoofed tenantId and resolve tenant securely from database disbursement (C1 & 2b hardening)', async () => {
      const attackerTenantId = '00000000-0000-0000-0000-000000000000';
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/mpesa-b2c-callback?tenantId=${attackerTenantId}`,
        headers: {
          'x-mpesa-webhook-token': 'mjengo-daraja-webhook-secret-production',
        },
        payload: {
          ConversationID: conversationId,
          OriginatorConversationID: 'AGY-TEST-ORIG-01',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          TransactionID: 'SKL99887766',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).tenantId).toBe(testTenantId);
    });

    it('should process inbound Daraja B2C callback and update transaction status to COMPLETED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/mpesa-b2c-callback?tenantId=${testTenantId}`,
        headers: {
          'x-mpesa-webhook-token': 'mjengo-daraja-webhook-secret-production',
        },
        payload: {
          ConversationID: conversationId,
          OriginatorConversationID: 'AGY-TEST-ORIG-01',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          TransactionID: 'SKL99887766',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).ResultDesc).toBe('Accepted');
    });

    it('should list B2C disbursements and calculate total disbursed KES for project', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/b2c-disbursements`,
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalDisbursements).toBeGreaterThanOrEqual(1);
      expect(body.summary.completedCount).toBeGreaterThanOrEqual(1);
      expect(Number(body.summary.totalDisbursedKes)).toBeGreaterThanOrEqual(12500);
    });
  });
});
