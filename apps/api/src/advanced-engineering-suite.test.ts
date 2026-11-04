import { describe, expect, it } from 'vitest';
import { buildServer } from './index';

describe('Milestones M27 & M28: Advanced Structural & Concrete Engineering Suite', () => {
  it('Milestone M27: Ready-Mix Concrete (RMC) Delivery & Transit Slump Tracker', async () => {
    const server = buildServer();

    // 1. Authenticate PM/QS user
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const { token, user } = JSON.parse(loginRes.payload);
    expect(user.tenant.id).toBeDefined();

    // 2. Create Project
    const projectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Kilimani Commercial Tower',
        code: `KIL-${Date.now().toString().slice(-4)}`,
        originalContractSum: 85000000,
        currentApprovedBudget: 85000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    const { data: projectData } = JSON.parse(projectRes.payload);
    const projectId = projectData.id;

    // 3. Register RMC Delivery Ticket (Dispatched 45 min ago - OPTIMAL)
    const dispatchTime = new Date(Date.now() - 45 * 60000).toISOString();
    const deliveryTicketNo = `RMC-TKT-${Date.now().toString().slice(-6)}`;

    const rmcRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/rmc-deliveries`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        deliveryTicketNo,
        supplierName: 'Bamburi Special Products Ltd',
        truckRegistrationNo: 'KDH 482B',
        driverName: 'Joseph Mutua',
        driverPhone: '+254711223344',
        concreteClass: 'CLASS_30_20',
        orderedVolumeM3: '7.50',
        dispatchedAt: dispatchTime,
        pourLocationElement: 'Zone 2 Suspended Floor Slab Grid 4-8',
      },
    });

    expect(rmcRes.statusCode).toBe(201);
    const rmcBody = JSON.parse(rmcRes.payload);
    expect(rmcBody.deliveryTicketNo).toBe(deliveryTicketNo);
    expect(rmcBody.concreteClass).toBe('CLASS_30_20');
    expect(rmcBody.orderedVolumeM3).toBe('7.50');
    expect(rmcBody.status).toBe('IN_TRANSIT');
    expect(rmcBody.transitEvaluation.status).toBe('OPTIMAL');
    const deliveryId = rmcBody.deliveryId;

    // 4. List Deliveries for Project
    const listDeliveriesRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/rmc-deliveries`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listDeliveriesRes.statusCode).toBe(200);
    const listBody = JSON.parse(listDeliveriesRes.payload);
    expect(listBody.summary.totalTruckloads).toBe(1);
    expect(listBody.summary.totalVolumeM3).toBe('7.50');
    expect(listBody.deliveries[0].id).toBe(deliveryId);

    // 5. Record Slump & Temperature Test (Target: 100mm, Measured: 110mm -> ACCEPTED)
    const slumpRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/rmc-deliveries/${deliveryId}/slump-tests`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        specifiedSlumpMm: 100,
        measuredSlumpMm: 110,
        slumpType: 'TRUE_SLUMP',
        concreteTemperatureC: 26.5,
        ambientTemperatureC: 24.0,
        testedByInspector: 'Eng. Francis Kimani (Resident RE)',
        cubesCastBatchNo: 'BT-KIL-001',
      },
    });

    expect(slumpRes.statusCode).toBe(201);
    const slumpBody = JSON.parse(slumpRes.payload);
    expect(slumpBody.isWithinTolerance).toBe(true);
    expect(slumpBody.deviationMm).toBe(10);
    expect(slumpBody.verdict).toBe('ACCEPTED');

    // 6. Record Second Slump Test with Excessive Slump Loss (Target: 100mm, Measured: 60mm -> REJECTED)
    const badSlumpRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/rmc-deliveries/${deliveryId}/slump-tests`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        specifiedSlumpMm: 100,
        measuredSlumpMm: 60,
        slumpType: 'TRUE_SLUMP',
        concreteTemperatureC: 29.0,
        testedByInspector: 'Eng. Francis Kimani (Resident RE)',
      },
    });
    expect(badSlumpRes.statusCode).toBe(201);
    const badSlumpBody = JSON.parse(badSlumpRes.payload);
    expect(badSlumpBody.isWithinTolerance).toBe(false);
    expect(badSlumpBody.verdict).toBe('REJECTED');

    // 7. Update Discharge & Water Added Audit
    const dischargeRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/rmc-deliveries/${deliveryId}/discharge`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        arrivedAt: new Date(Date.now() - 35 * 60000).toISOString(),
        dischargeStartedAt: new Date(Date.now() - 30 * 60000).toISOString(),
        dischargeCompletedAt: new Date().toISOString(),
        waterAddedOnSiteLiters: 0,
        status: 'COMPLETED',
      },
    });
    expect(dischargeRes.statusCode).toBe(200);
    const dischargeBody = JSON.parse(dischargeRes.payload);
    expect(dischargeBody.status).toBe('COMPLETED');
    expect(dischargeBody.waterAddedOnSiteLiters).toBe('0.00');

    // 8. SQLi in URL path trapped by UUID regex
    const sqliRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/rmc-deliveries/1' OR '1'='1`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sqliRes.statusCode).toBe(404);

    // 9. RLS Cross-tenant isolation verification
    const tenantBId = '22222222-2222-2222-2222-222222222222';
    const rogueToken = server.jwt.sign({
      sub: 'user-b',
      email: 'rogue@other.com',
      fullName: 'Rogue User',
      tenantId: tenantBId,
      role: 'PM_QS',
    });

    const crossTenantRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/rmc-deliveries`,
      headers: { authorization: `Bearer ${rogueToken}` },
    });
    expect(crossTenantRes.statusCode).toBe(404);
  });

  it('Milestone M28: Structural Steel Framing & Fabrication Takeoff', async () => {
    const server = buildServer();

    // 1. Authenticate PM/QS user
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    const { token } = JSON.parse(loginRes.payload);

    // 2. Create Project
    const projectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Tatu City Logistics Warehouse',
        code: `TATU-${Date.now().toString().slice(-4)}`,
        originalContractSum: 120000000,
        currentApprovedBudget: 120000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    const { data: projectData } = JSON.parse(projectRes.payload);
    const projectId = projectData.id;

    // 3. Create Structural Steel Takeoff
    // - 8 Rafters UB 406x178x74 (74.2 kg/m, 1.51 m2/m), length 12.500m -> Total length = 100m, Weight = 7,420 kg, Paint Area = 151 m2
    // - 8 Columns UC 203x203x46 (46.1 kg/m, 1.20 m2/m), length 8.000m -> Total length = 64m, Weight = 2,950.40 kg, Paint Area = 76.80 m2
    // - 20 Purlins RHS 100x50x4.0 (8.77 kg/m, 0.29 m2/m), length 6.000m -> Total length = 120m, Weight = 1,052.40 kg, Paint Area = 34.80 m2
    // Total Takeoff Weight = 7420 + 2950.40 + 1052.40 = 11,422.80 kg = 11.423 Tonnes
    // Total Takeoff Paint Area = 151 + 76.80 + 34.80 = 262.60 m2
    const takeoffNo = `STL-${Date.now().toString().slice(-6)}`;
    const createRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/structural-steel-takeoffs`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        takeoffNo,
        structureTitle: 'Warehouse Main Portal Frame Grid 1-8',
        drawingReference: 'STR/STL/W01-REV2',
        steelGrade: 'S355JR',
        members: [
          {
            memberMark: 'RAFTER-R1',
            sectionType: 'UB',
            sectionDesignation: 'UB 406x178x74',
            lengthMeters: '12.500',
            quantity: 8,
            connectionBoltsCount: 64,
          },
          {
            memberMark: 'COLUMN-C1',
            sectionType: 'UC',
            sectionDesignation: 'UC 203x203x46',
            lengthMeters: '8.000',
            quantity: 8,
            connectionBoltsCount: 32,
          },
          {
            memberMark: 'PURLIN-P1',
            sectionType: 'RHS',
            sectionDesignation: 'RHS 100x50x4.0',
            lengthMeters: '6.000',
            quantity: 20,
            connectionBoltsCount: 40,
          },
        ],
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.payload);
    expect(createBody.takeoffNo).toBe(takeoffNo);
    expect(createBody.steelGrade).toBe('S355JR');
    expect(createBody.totalTonnage).toBe('11.422');
    expect(createBody.totalPaintAreaM2).toBe('262.60');
    expect(createBody.memberCount).toBe(3);
    expect(createBody.status).toBe('DRAFT');
    const takeoffId = createBody.takeoffId;

    // 4. List Structural Steel Takeoffs for Project
    const listRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/structural-steel-takeoffs`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.payload);
    expect(listBody.summary.totalTakeoffs).toBe(1);
    expect(listBody.summary.totalTonnage).toBe('11.422');
    expect(listBody.summary.totalPaintAreaM2).toBe('262.60');

    // 5. Retrieve Single Takeoff Details with Members
    const getRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/structural-steel-takeoffs/${takeoffId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.members.length).toBe(3);
    const rafter = getBody.members.find((m: any) => m.memberMark === 'RAFTER-R1');
    expect(rafter.totalWeightKg).toBe('7420.00');
    expect(rafter.totalPaintAreaM2).toBe('151.00');

    // 6. Update Takeoff Status to QS_APPROVED
    const statusRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/structural-steel-takeoffs/${takeoffId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'QS_APPROVED' },
    });
    expect(statusRes.statusCode).toBe(200);
    const statusBody = JSON.parse(statusRes.payload);
    expect(statusBody.status).toBe('QS_APPROVED');

    // 7. Reject invalid status
    const badStatusRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/structural-steel-takeoffs/${takeoffId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'INVALID_STATUS' },
    });
    expect(badStatusRes.statusCode).toBe(400);

    // 8. SQLi in URL path trapped by UUID regex
    const sqliRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/structural-steel-takeoffs/1' OR '1'='1`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sqliRes.statusCode).toBe(404);

    // 9. RLS Cross-tenant isolation verification
    const tenantBId = '22222222-2222-2222-2222-222222222222';
    const rogueToken = server.jwt.sign({
      sub: 'user-b',
      email: 'rogue@other.com',
      fullName: 'Rogue User',
      tenantId: tenantBId,
      role: 'PM_QS',
    });

    const crossTenantRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/structural-steel-takeoffs`,
      headers: { authorization: `Bearer ${rogueToken}` },
    });
    expect(crossTenantRes.statusCode).toBe(404);
  });
});
