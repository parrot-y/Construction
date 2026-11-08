import { describe, expect, it } from 'vitest';
import { buildServer } from './index';
import { enrollAllTenantUsers } from './test-members';

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
    await enrollAllTenantUsers(projectId);

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

  it('Milestone M29: Geotechnical Soil Compaction QA Engine', async () => {
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

    // 2. Create Project
    const projectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Mombasa Road Dualing Phase 2',
        code: `MRD-${Date.now().toString().slice(-4)}`,
        originalContractSum: 350000000,
        currentApprovedBudget: 350000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    const { data: projectData } = JSON.parse(projectRes.payload);
    const projectId = projectData.id;

    // 3. Post Soil Compaction Test (Compliant)
    const testNumber = `SOIL-CMP-${Date.now().toString().slice(-6)}`;
    const soilRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/soil-tests`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        testNumber,
        locationElement: 'Ch 2+400 - 2+650 Heavy Subbase',
        layerType: 'SUBBASE',
        testMethod: 'SAND_REPLACEMENT',
        laboratoryMddGCm3: '2.150',
        laboratoryOmcPercent: '9.50',
        fieldWetDensityGCm3: '2.260',
        fieldMoisturePercent: '10.00',
        requiredCompactionPercent: '95.00',
        dcpBlowsPer100mm: 18,
        inspectedBy: 'Eng. Francis Kimani (Resident QA)',
      },
    });

    expect(soilRes.statusCode).toBe(201);
    const soilBody = JSON.parse(soilRes.payload);
    expect(soilBody.testNumber).toBe(testNumber);
    expect(soilBody.fieldDryDensityGCm3).toBe('2.055');
    expect(soilBody.relativeCompactionPercent).toBe('95.58');
    expect(soilBody.qaVerdict).toBe('PASS');
    expect(soilBody.isPass).toBe(true);
    expect(soilBody.status).toBe('VERIFIED');
    expect(soilBody.estimatedCbrPercent).not.toBeNull();

    // 4. List Soil Tests
    const listRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/soil-tests`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.payload);
    expect(listBody.summary.totalTests).toBe(1);
    expect(listBody.summary.passedCount).toBe(1);
    expect(listBody.summary.complianceRatePercent).toBe('100.0');

    // 5. Duplicate testNumber returns 409 Conflict (P2002 handler)
    const dupRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/soil-tests`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        testNumber,
        locationElement: 'Duplicate Section',
        layerType: 'SUBBASE',
        laboratoryMddGCm3: '2.150',
        laboratoryOmcPercent: '9.50',
        fieldWetDensityGCm3: '2.260',
        fieldMoisturePercent: '10.00',
        inspectedBy: 'Eng. Francis Kimani',
      },
    });
    expect(dupRes.statusCode).toBe(409);

    // 6. Zero or unconstrained laboratory MDD is rejected with 400 Bad Request
    const zeroMddRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/soil-tests`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        testNumber: `SOIL-ZERO-${Date.now()}`,
        locationElement: 'Ch 2+900',
        laboratoryMddGCm3: '0.000',
        laboratoryOmcPercent: '9.50',
        fieldWetDensityGCm3: '2.260',
        fieldMoisturePercent: '10.00',
        inspectedBy: 'Eng. Francis Kimani',
      },
    });
    expect(zeroMddRes.statusCode).toBe(400);

    // 7. CLIENT role is blocked with 403 Forbidden
    const clientToken = server.jwt.sign({
      sub: 'client-user-1',
      email: 'client@investor.co.ke',
      fullName: 'Client Investor',
      tenantId: user.tenant.id,
      role: 'CLIENT',
    });

    const clientSoilRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/soil-tests`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        testNumber: `SOIL-CLIENT-${Date.now()}`,
        locationElement: 'Client test',
        laboratoryMddGCm3: '2.150',
        laboratoryOmcPercent: '9.50',
        fieldWetDensityGCm3: '2.260',
        fieldMoisturePercent: '10.00',
        inspectedBy: 'Client',
      },
    });
    expect(clientSoilRes.statusCode).toBe(403);

    // 8. SQLi path rejection
    const sqliRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/soil-tests/1' OR '1'='1`,
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
      url: `/api/v1/projects/${projectId}/soil-tests`,
      headers: { authorization: `Bearer ${rogueToken}` },
    });
    expect(crossTenantRes.statusCode).toBe(404);
  });

  it('Milestone M30: Asphalt Pavement Quality & Thermal Tracker', async () => {
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

    // 2. Create Project
    const projectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Western Bypass Paving Section 4',
        code: `WBP-${Date.now().toString().slice(-4)}`,
        originalContractSum: 550000000,
        currentApprovedBudget: 550000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    const { data: projectData } = JSON.parse(projectRes.payload);
    const projectId = projectData.id;

    // 3. Register Asphalt Batch with Thermal Quality
    const ticketNumber = `ASP-TKT-${Date.now().toString().slice(-6)}`;
    const aspRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/asphalt-batches`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ticketNumber,
        supplierName: 'Colas East Africa Ltd',
        mixType: 'AC_14_WEARING',
        truckRegNo: 'KDF 994L',
        tonnageTons: '24.50',
        chainageStart: 'Ch 12+100',
        chainageEnd: 'Ch 12+350',
        laneDirection: 'MAIN_CARRIAGEWAY',
        plantTempC: '165.0',
        deliveryTempC: '148.0',
        breakdownTempC: '132.0',
        finishTempC: '92.0',
        designThicknessMm: '50.00',
        inspectedBy: 'Eng. David Nderitu',
      },
    });

    expect(aspRes.statusCode).toBe(201);
    const aspBody = JSON.parse(aspRes.payload);
    expect(aspBody.ticketNumber).toBe(ticketNumber);
    expect(aspBody.mixType).toBe('AC_14_WEARING');
    expect(aspBody.tonnageTons).toBe('24.50');
    expect(aspBody.thermalVerdict).toBe('COMPLIANT');
    expect(aspBody.isPavingApproved).toBe(true);
    expect(aspBody.status).toBe('LAID');
    const batchId = aspBody.id;

    // 4. Record Core Extraction Test on Pavement Batch
    const coreRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/asphalt-batches/${batchId}/core-test`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        coreThicknessMm: '52.00',
        coreDensityGCm3: '2.340',
        marshallDensityGCm3: '2.400',
      },
    });

    expect(coreRes.statusCode).toBe(200);
    const coreBody = JSON.parse(coreRes.payload);
    expect(coreBody.coreThicknessMm).toBe('52.0');
    expect(coreBody.thicknessDeviationMm).toBe('2.0');
    expect(coreBody.compactionPercent).toBe('97.50');
    expect(coreBody.qaVerdict).toBe('ACCEPTED');
    expect(coreBody.status).toBe('COMPLETED');

    // 5. Duplicate ticketNumber returns 409 Conflict
    const dupAspRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/asphalt-batches`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ticketNumber,
        supplierName: 'Colas East Africa Ltd',
        mixType: 'AC_14_WEARING',
        truckRegNo: 'KDF 994L',
        tonnageTons: '24.50',
        chainageStart: 'Ch 12+100',
        chainageEnd: 'Ch 12+350',
        plantTempC: '165.0',
        deliveryTempC: '148.0',
        breakdownTempC: '132.0',
        finishTempC: '92.0',
        inspectedBy: 'Eng. David Nderitu',
      },
    });
    expect(dupAspRes.statusCode).toBe(409);

    // 6. Cold Paved Batch (Delivery 130°C < 135°C threshold) is immediately rejected
    const coldTicket = `ASP-COLD-${Date.now().toString().slice(-6)}`;
    const coldRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/asphalt-batches`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ticketNumber: coldTicket,
        supplierName: 'Colas East Africa Ltd',
        mixType: 'AC_14_WEARING',
        truckRegNo: 'KDF 995M',
        tonnageTons: '20.00',
        chainageStart: 'Ch 12+350',
        chainageEnd: 'Ch 12+500',
        plantTempC: '150.0',
        deliveryTempC: '130.0',
        breakdownTempC: '115.0',
        finishTempC: '76.0',
        inspectedBy: 'Eng. David Nderitu',
      },
    });
    expect(coldRes.statusCode).toBe(201);
    const coldBatch = JSON.parse(coldRes.payload);
    expect(coldBatch.thermalVerdict).toBe('REJECTED_COLD_PAVING');
    expect(coldBatch.status).toBe('REJECTED');

    // 7. Core test on cold-paved batch preserves REJECTED status (no unauthorized override)
    const coldCoreRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/asphalt-batches/${coldBatch.id}/core-test`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        coreThicknessMm: '50.00',
        coreDensityGCm3: '2.350',
        marshallDensityGCm3: '2.400',
      },
    });
    expect(coldCoreRes.statusCode).toBe(200);
    const coldCoreBody = JSON.parse(coldCoreRes.payload);
    expect(coldCoreBody.status).toBe('REJECTED');

    // 8. CLIENT role is blocked with 403 Forbidden
    const clientToken = server.jwt.sign({
      sub: 'client-user-2',
      email: 'client@asphalt.co.ke',
      fullName: 'Client User',
      tenantId: user.tenant.id,
      role: 'CLIENT',
    });

    const clientAspRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/asphalt-batches`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        ticketNumber: `ASP-CLIENT-${Date.now()}`,
        supplierName: 'Colas',
        truckRegNo: 'KAA 001A',
        tonnageTons: '20.00',
        chainageStart: 'Ch 0+000',
        chainageEnd: 'Ch 0+100',
        plantTempC: '160.0',
        deliveryTempC: '145.0',
        breakdownTempC: '130.0',
        finishTempC: '90.0',
        inspectedBy: 'Client',
      },
    });
    expect(clientAspRes.statusCode).toBe(403);

    // 9. List Asphalt Batches for Project
    const listRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/asphalt-batches`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.payload);
    expect(listBody.summary.totalTruckloads).toBe(2);

    // 10. SQLi URL path rejection
    const sqliRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/asphalt-batches/1' OR '1'='1`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sqliRes.statusCode).toBe(404);

    // 11. RLS Cross-tenant isolation verification
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
      url: `/api/v1/projects/${projectId}/asphalt-batches`,
      headers: { authorization: `Bearer ${rogueToken}` },
    });
    expect(crossTenantRes.statusCode).toBe(404);
  });

  it('Milestone M31: Survey & Topographic Cut/Fill Earthworks Engine (Simpson Rule, Prismoidal Corrections & Mass Haul)', async () => {
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

    // 2. Create Highway Earthworks Project
    const projectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'A104 Mau Summit Highway Earthworks',
        code: `HWY-${Date.now().toString().slice(-4)}`,
        originalContractSum: 150000000,
        currentApprovedBudget: 150000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    const { data: projectData } = JSON.parse(projectRes.payload);
    const projectId = projectData.id;

    // 3. Create Topographic Survey with 3 Cross-Section Stations
    // Station 0+000: Ch 0.00m, EGL 1850.500m, PFL 1845.000m, Cut Area = 45.000 m2
    // Station 0+050: Ch 50.00m, EGL 1853.000m, PFL 1845.000m, Cut Area = 80.000 m2, Mid-Cut = 60.000 m2
    //   -> Prismoidal cut volume between 0 and 50m: (50/6)*(45 + 4*60 + 80) = (50/6)*365 = 3041.667 m3
    // Station 1+200: Ch 1200.00m, EGL 1845.000m, PFL 1845.000m, Cut Area = 0, Fill Area = 0
    // Total survey span = 1200m > FHD (500m).
    // Freehaul Distance = 500m, Overhaul Rate = KES 85.00, Borrow Rate = KES 350.00.
    // ELH = 500 + (350 / 85) = 504.12m.
    const surveyCode = `SURV-RD-A104-${Date.now().toString().slice(-5)}`;
    const surveyPayload = {
      surveyCode,
      title: 'A104 Alignment Chainage 0+000 to 1+200 Earthworks Takeoff',
      surveyDate: new Date().toISOString(),
      surveyorName: 'Surv. Geoffrey Kiprop',
      instrumentType: 'TOTAL_STATION',
      calculationMethod: 'PRISMOIDAL',
      bulkingFactor: '1.200',
      shrinkageFactor: '0.900',
      freehaulDistanceMeters: '500.00',
      overhaulUnitRateKes: '85.00',
      borrowUnitRateKes: '350.00',
      stations: [
        {
          stationIndex: 0,
          chainageMeters: '0.00',
          chainageLabel: 'Ch 0+000',
          existingGroundLevelM: '1850.500',
          proposedFormationLevelM: '1845.000',
          cutAreaM2: '45.000',
          fillAreaM2: '0.000',
        },
        {
          stationIndex: 1,
          chainageMeters: '50.00',
          chainageLabel: 'Ch 0+050',
          existingGroundLevelM: '1853.000',
          proposedFormationLevelM: '1845.000',
          cutAreaM2: '80.000',
          fillAreaM2: '0.000',
          midCutAreaM2: '60.000',
        },
        {
          stationIndex: 2,
          chainageMeters: '1200.00',
          chainageLabel: 'Ch 1+200',
          existingGroundLevelM: '1845.000',
          proposedFormationLevelM: '1845.000',
          cutAreaM2: '0.000',
          fillAreaM2: '0.000',
        },
      ],
    };

    const createRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${token}` },
      payload: surveyPayload,
    });

    expect(createRes.statusCode).toBe(201);
    const surveyBody = JSON.parse(createRes.payload);
    expect(surveyBody.surveyCode).toBe(surveyCode);
    expect(surveyBody.stationCount).toBe(3);
    expect(surveyBody.calculationMethod).toBe('PRISMOIDAL');
    expect(surveyBody.economicHaulLimitMeters).toBe('504.12');

    // Verify Prismoidal volume accuracy between station 0 and station 1
    const st1 = surveyBody.stations.find((s: any) => s.stationIndex === 1);
    expect(st1).toBeDefined();
    expect(st1.intervalDistanceM).toBe('50.00');
    expect(st1.intervalCutVolumeM3).toBe('3041.667');
    expect(st1.cumulativeMassOrdinateM3).toBe('3041.667');

    // Total cut volume should be >= 3041.667 m3
    expect(Number(surveyBody.totalCutVolumeM3)).toBeGreaterThanOrEqual(3041.667);
    expect(Number(surveyBody.totalOverhaulCostKes)).toBeGreaterThan(0);

    // 4. Duplicate Survey Code Rejection (P2002 conflict -> 409)
    const dupRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${token}` },
      payload: surveyPayload,
    });
    expect(dupRes.statusCode).toBe(409);
    const dupBody = JSON.parse(dupRes.payload);
    expect(dupBody.message).toBe('A topographic survey with this survey code already exists for this project');

    // 5. Payload Validation Error (< 2 stations -> 400 Bad Request)
    const invalidRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ...surveyPayload,
        surveyCode: `SURV-INVALID-${Date.now()}`,
        stations: [surveyPayload.stations[0]], // only 1 station
      },
    });
    expect(invalidRes.statusCode).toBe(400);

    // 6. CLIENT Role Guard (403 Forbidden)
    const clientToken = server.jwt.sign({
      sub: 'client-user-survey',
      email: 'client@survey.co.ke',
      fullName: 'Client Rep',
      tenantId: user.tenant.id,
      role: 'CLIENT',
    });

    const clientRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        ...surveyPayload,
        surveyCode: `SURV-CLIENT-${Date.now()}`,
      },
    });
    expect(clientRes.statusCode).toBe(403);
    const clientBody = JSON.parse(clientRes.payload);
    expect(clientBody.message).toContain('read-only access');

    // 7. List Surveys for Project (200 OK)
    const listRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.payload);
    expect(Array.isArray(listBody)).toBe(true);
    expect(listBody.length).toBeGreaterThanOrEqual(1);
    const listed = listBody.find((s: any) => s.id === surveyBody.id);
    expect(listed).toBeDefined();
    expect(listed.surveyCode).toBe(surveyCode);
    expect(listed.stationCount).toBe(3);

    // 8. Get Survey Details with Ordered Stations (200 OK)
    const getRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/topographic-surveys/${surveyBody.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.id).toBe(surveyBody.id);
    expect(getBody.stations).toHaveLength(3);
    expect(getBody.stations[0].stationIndex).toBe(0);
    expect(getBody.stations[1].stationIndex).toBe(1);
    expect(getBody.stations[2].stationIndex).toBe(2);
    expect(getBody.stations[0].chainageLabel).toBe('Ch 0+000');
    expect(getBody.stations[1].chainageLabel).toBe('Ch 0+050');
    expect(getBody.stations[2].chainageLabel).toBe('Ch 1+200');

    // 9. Verify Simpson's 1/3 Rule automatic calculation from offsetsAndLevels
    // 5 cross-section points spaced at h = 2.0m:
    // offsets: -4, -2, 0, 2, 4
    // elevations: 1847, 1849, 1851, 1850, 1848
    // PFL: 1845.000
    // depths: 2.0, 4.0, 6.0, 5.0, 3.0 -> Simpson's area = 35.333 m2
    const simpsonSurveyRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        surveyCode: `SURV-SIMPSON-${Date.now()}`,
        title: 'Simpson Rule Offset Calibration Test',
        surveyorName: 'Surv. Kiprop',
        instrumentType: 'RTK_GNSS',
        stations: [
          {
            stationIndex: 0,
            chainageMeters: '0.00',
            chainageLabel: 'Ch 0+000',
            existingGroundLevelM: '1851.000',
            proposedFormationLevelM: '1845.000',
            cutAreaM2: 0,
            fillAreaM2: 0,
            offsetsAndLevels: [
              [-4, 1847],
              [-2, 1849],
              [0, 1851],
              [2, 1850],
              [4, 1848],
            ],
          },
          {
            stationIndex: 1,
            chainageMeters: '20.00',
            chainageLabel: 'Ch 0+020',
            existingGroundLevelM: '1851.000',
            proposedFormationLevelM: '1845.000',
            cutAreaM2: '35.333',
            fillAreaM2: 0,
          },
        ],
      },
    });
    expect(simpsonSurveyRes.statusCode).toBe(201);
    const simpsonSurveyBody = JSON.parse(simpsonSurveyRes.payload);
    expect(simpsonSurveyBody.stations[0].cutAreaM2).toBe('35.333');

    // 10. Non-existent survey returns 404
    const notFoundRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/topographic-surveys/00000000-0000-0000-0000-000000000000`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(notFoundRes.statusCode).toBe(404);
  });

  it('Milestone M32: Mobile Plant CAN-bus IoT OBD-II Telematics & Deep Fuel Siphoning Anomaly Detector & Predictive Maintenance', async () => {
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

    // 2. Create Project
    const projectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Konza Smart City Earthmoving Depot',
        code: `KNZ-${Date.now().toString().slice(-4)}`,
        originalContractSum: 95000000,
        currentApprovedBudget: 95000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    const { data: projectData } = JSON.parse(projectRes.payload);
    const projectId = projectData.id;

    // 3. Create Plant Equipment
    const equipRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/equipment`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'CAT 336D Hydraulic Excavator',
        equipmentCode: `EXC-336-${Date.now().toString().slice(-4)}`,
        equipmentType: 'EXCAVATOR',
        registrationNumber: 'KDH 100Z',
        hourlyRateKes: 7500,
      },
    });
    expect(equipRes.statusCode).toBe(201);
    const equipBody = JSON.parse(equipRes.payload);
    const equipmentId = equipBody.equipment.id;

    // 4. Register CAN-bus OBD-II Device to Machinery
    const deviceImei = `86901205${Date.now().toString().slice(-7)}`;
    const deviceToken = `canbus-token-${Date.now()}`;
    const regRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/canbus-devices`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        equipmentId,
        deviceImei,
        deviceToken,
        protocol: 'CANBUS',
        canBusBaudRate: 250000,
        maxEngineBurnRateLph: '38.50',
        simPhoneNumber: '+254711998877',
        calibrationTankCapacityLiters: '400.00',
        tankGeometry: 'RECTANGULAR',
      },
    });
    expect(regRes.statusCode).toBe(201);
    const regBody = JSON.parse(regRes.payload);
    expect(regBody.deviceImei).toBe(deviceImei);
    expect(regBody.canBusBaudRate).toBe(250000);
    expect(regBody.maxEngineBurnRateLph).toBe('38.50');
    expect(regBody.calibrationTankCapacityLiters).toBe('400.00');
    expect(regBody.tankGeometry).toBe('RECTANGULAR');
    expect(regBody.status).toBe('ONLINE');

    // 5. P2002 Conflict check on duplicate IMEI or Equipment
    const dupRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/canbus-devices`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        equipmentId,
        deviceImei,
        protocol: 'CANBUS',
        canBusBaudRate: 250000,
        maxEngineBurnRateLph: '38.50',
        calibrationTankCapacityLiters: '400.00',
        tankGeometry: 'RECTANGULAR',
      },
    });
    expect(dupRes.statusCode).toBe(409);
    const dupBody = JSON.parse(dupRes.payload);
    expect(dupBody.message).toBe('A telematics device with this IMEI or for this equipment already exists');

    // 6. CLIENT role is blocked with 403 Forbidden from registering devices
    const clientToken = server.jwt.sign({
      sub: 'client-user-m32',
      email: 'client@konza.co.ke',
      fullName: 'Client Consultant',
      tenantId: user.tenant.id,
      role: 'CLIENT',
    });

    const clientRegRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/canbus-devices`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        equipmentId,
        deviceImei: `86901205${Date.now().toString().slice(-7)}`,
        canBusBaudRate: 250000,
        maxEngineBurnRateLph: '38.50',
        calibrationTankCapacityLiters: '400.00',
      },
    });
    expect(clientRegRes.statusCode).toBe(403);

    // 7. Ingest Baseline Normal CAN-bus Telematics Ping (Engine RUNNING, 85% fuel = 340.00L)
    const ping1Res = await server.inject({
      method: 'POST',
      url: '/api/v1/telematics/canbus-ping',
      payload: {
        deviceImei,
        deviceToken,
        latitude: '-1.292100',
        longitude: '36.821900',
        engineStatus: 'RUNNING',
        engineRpm: 1850,
        coolantTempC: '92.4',
        oilTempC: '98.0',
        fuelRateLPerH: '21.50',
        engineLoadPercent: '68.00',
        speedKmh: '0.0',
        batteryVoltage: '24.20',
        cumulativeEngineSeconds: 36000,
        fuelLevelPercent: '85.00',
      },
    });
    expect(ping1Res.statusCode).toBe(200);
    const ping1Body = JSON.parse(ping1Res.payload);
    expect(ping1Body.calculatedFuelLiters).toBe('340.00');
    expect(ping1Body.coolantTempC).toBe('92.4');
    expect(ping1Body.batteryVoltage).toBe('24.20');
    expect(ping1Body.isSiphoningEvent).toBe(false);
    expect(ping1Body.anomalySeverity).toBe('NONE');

    // 8. Ingest CAN-bus Ping with Rapid Diesel Siphoning Drop (Engine STOPPED, fuel drops from 340L to 300L = 40L drop)
    const ping2Res = await server.inject({
      method: 'POST',
      url: '/api/v1/telematics/canbus-ping',
      payload: {
        deviceImei,
        deviceToken,
        latitude: '-1.292100',
        longitude: '36.821900',
        engineStatus: 'STOPPED',
        engineRpm: 0,
        coolantTempC: '65.0',
        oilTempC: '70.0',
        fuelRateLPerH: '0.00',
        engineLoadPercent: '0.00',
        speedKmh: '0.0',
        batteryVoltage: '24.10',
        cumulativeEngineSeconds: 36000,
        fuelLevelPercent: '75.00', // 300L (40L loss while STOPPED)
      },
    });
    expect(ping2Res.statusCode).toBe(200);
    const ping2Body = JSON.parse(ping2Res.payload);
    expect(ping2Body.calculatedFuelLiters).toBe('300.00');
    expect(ping2Body.fuelDropLiters).toBe('40.00');
    expect(ping2Body.isSiphoningEvent).toBe(true);
    expect(ping2Body.anomalySeverity).toBe('CRITICAL');
    expect(['RAPID_UNLOGGED_DROP', 'RAPID_THEFT_SIPHON']).toContain(ping2Body.siphoningEvaluation.anomalyType);
    expect(ping2Body.createdAlertsCount).toBeGreaterThanOrEqual(1);

    // 9. Ingest CAN-bus Ping with Severe Engine Overheat (>108°C) & Active DTC Codes
    const ping3Res = await server.inject({
      method: 'POST',
      url: '/api/v1/telematics/canbus-ping',
      payload: {
        deviceImei,
        deviceToken,
        latitude: '-1.292100',
        longitude: '36.821900',
        engineStatus: 'RUNNING',
        engineRpm: 2200,
        coolantTempC: '112.5', // > 108°C FATAL_SHUTDOWN threshold
        oilTempC: '124.0', // > 120°C oil thermal warning
        fuelRateLPerH: '32.00',
        batteryVoltage: '24.00',
        dtcFaultCodes: 'P0115,P0217',
        cumulativeEngineSeconds: 36600,
        fuelLevelPercent: '74.00',
      },
    });
    expect(ping3Res.statusCode).toBe(200);
    const ping3Body = JSON.parse(ping3Res.payload);
    expect(ping3Body.diagnostics.hasThermalAlarm).toBe(true);
    expect(ping3Body.diagnostics.hasDtcAlarm).toBe(true);
    expect(ping3Body.diagnostics.alertSeverity).toBe('FATAL_SHUTDOWN');
    expect(ping3Body.createdAlertsCount).toBeGreaterThanOrEqual(1);

    // 10. List Plant Maintenance Alerts for Project
    const alertsRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/maintenance-alerts`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(alertsRes.statusCode).toBe(200);
    const alertsBody = JSON.parse(alertsRes.payload);
    expect(alertsBody.totalAlerts).toBeGreaterThanOrEqual(2);
    expect(alertsBody.activeAlertsCount).toBeGreaterThanOrEqual(2);

    const siphAlert = alertsBody.alerts.find((a: any) => a.alertType === 'SIPHONING_THEFT' || a.alertType === 'FUEL_DISCREPANCY');
    expect(siphAlert).toBeDefined();
    expect(siphAlert.severity).toBe('CRITICAL');
    expect(siphAlert.status).toBe('ACTIVE');

    const diagAlert = alertsBody.alerts.find((a: any) => a.alertType === 'ENGINE_OVERHEAT');
    expect(diagAlert).toBeDefined();
    expect(diagAlert.dtcCode).toContain('P0115');

    // 11. Client role is blocked with 403 Forbidden from acknowledging alerts
    const clientAckRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/maintenance-alerts/${siphAlert.id}/acknowledge`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        acknowledgedBy: 'Unauthorized Client',
        actionNotes: 'Attempting client ack',
      },
    });
    expect(clientAckRes.statusCode).toBe(403);

    // 12. PM/QS Acknowledges the Siphoning Alert
    const ackRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/maintenance-alerts/${siphAlert.id}/acknowledge`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        acknowledgedBy: 'Eng. Sarah Mwangi (Lead Plant Engineer)',
        actionNotes: 'Physical fuel dip confirmed 40L missing. CCTV footage archived for police report.',
      },
    });
    expect(ackRes.statusCode).toBe(200);
    const ackBody = JSON.parse(ackRes.payload);
    expect(ackBody.status).toBe('ACKNOWLEDGED');
    expect(ackBody.acknowledgedBy).toBe('Eng. Sarah Mwangi (Lead Plant Engineer)');

    // 13. Verify Alert List reflects ACKNOWLEDGED status
    const verifiedAlertsRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/maintenance-alerts?status=ACKNOWLEDGED`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(verifiedAlertsRes.statusCode).toBe(200);
    const verifiedAlertsBody = JSON.parse(verifiedAlertsRes.payload);
    expect(verifiedAlertsBody.alerts.some((a: any) => a.id === siphAlert.id)).toBe(true);

    // 14. O(1) device lookup returns 404 for unregistered IMEI
    const notFoundImeiRes = await server.inject({
      method: 'POST',
      url: '/api/v1/telematics/canbus-ping',
      payload: {
        deviceImei: '999999999999999',
        latitude: '-1.292100',
        longitude: '36.821900',
        fuelLevelPercent: '50.00',
      },
    });
    expect(notFoundImeiRes.statusCode).toBe(404);
  });
});
