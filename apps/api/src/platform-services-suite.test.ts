import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

describe('Milestones M22, M23 & M24: Platform Services & Site Telematics Suite', () => {
  let app: FastifyInstance;
  let authCookie: string;
  let testTenantId: string;
  let testProjectId: string;
  let testEquipmentId: string;
  let testLaborerId: string;

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
      expect(body.customerMessage).toContain('STK push dispatched to 254712345678');
      capturedCheckoutRequestId = body.checkoutRequestId;
    });

    it('should return 404 when processing callback for unknown checkout request ID', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/mpesa-callback',
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
        url: '/api/v1/billing/mpesa-callback',
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
          photoSelfieUrl: 'https://storage.mjengoledger.co.ke/selfies/wkr999_in.jpg',
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

    it('should ingest normal telematics ping (engine running, 80% fuel = 320L)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telematics/ping',
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

      // Verify that an automated SiteAlertNotification of type DIESEL_SIPHONING_FLAG was dispatched
      const alert = await withTenantTx(prisma, testTenantId, (tx) =>
        tx.siteAlertNotification.findFirst({
          where: {
            project_id: testProjectId,
            alert_type: 'DIESEL_SIPHONING_FLAG',
          },
        })
      );

      expect(alert).toBeDefined();
      expect(alert?.message_body).toContain('Rapid fuel drop of 40.0L detected');
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
});
