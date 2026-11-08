import { describe, expect, it } from 'vitest';
import { buildServer } from './index';
import { enrollAllTenantUsers } from './test-members';

async function loginToken(server: any, email: string): Promise<string> {
  const res = await server.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  });
  return JSON.parse(res.payload).token;
}

describe('Security Penetration & Vulnerability Verification Suite (ADR-001 / Milestones M31-M32)', () => {
  it('SEC-01 & SEC-02: RBAC Intra-Tenant Role Guard Audit - CLIENT Role Mutation Rejection (403 Forbidden)', async () => {
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
    const tenantId = user.tenant.id;
    void tenantId;

    // 2. Create Project
    const projectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Secured Infrastructure Corridor',
        code: `SEC-${Date.now().toString().slice(-4)}`,
        originalContractSum: 200000000,
        currentApprovedBudget: 200000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    const { data: projectData } = JSON.parse(projectRes.payload);
    const projectId = projectData.id;
    await enrollAllTenantUsers(projectId);

    // Create equipment items for tests
    const equipRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/equipment`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Komatsu PC200 Excavator',
        equipmentCode: `EXC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        equipmentType: 'EXCAVATOR',
        registrationNo: 'KDK 888X',
      },
    });
    expect(equipRes.statusCode).toBe(201);
    const { equipment } = JSON.parse(equipRes.payload);

    // Create an active maintenance alert to test acknowledgement
    const initialImei = `86${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;
    const initialToken = `tok-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const devRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/canbus-devices`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        equipmentId: equipment.id,
        deviceImei: initialImei,
        deviceToken: initialToken,
        protocol: 'CANBUS',
      },
    });
    expect(devRes.statusCode).toBe(201);
    const devBody = JSON.parse(devRes.payload);

    // Generate alert via CAN-bus ping with high overheat
    const pingRes = await server.inject({
      method: 'POST',
      url: '/api/v1/telematics/canbus-ping',
      headers: { authorization: `Bearer ${devBody.deviceToken}` },
      payload: {
        deviceImei: devBody.deviceImei,
        deviceToken: devBody.deviceToken,
        latitude: '-1.286389',
        longitude: '36.817223',
        engineStatus: 'RUNNING',
        coolantTempC: '115.0',
        fuelLevelPercent: '80.00',
      },
    });
    expect(pingRes.statusCode).toBe(200);

    const alertsRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/maintenance-alerts`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(alertsRes.statusCode).toBe(200);
    const { alerts } = JSON.parse(alertsRes.payload);
    expect(alerts.length).toBeGreaterThan(0);
    const alertId = alerts[0].id;

    // Create a batch for asphalt core testing
    const batchRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/asphalt-batches`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ticketNumber: `ASP-SEC-${Date.now()}`,
        supplierName: 'Colas Kenya',
        mixType: 'AC_14_WEARING',
        truckRegNo: 'KAA 001Z',
        tonnageTons: '25.00',
        chainageStart: 'Ch 0+000',
        chainageEnd: 'Ch 0+200',
        plantTempC: '160.0',
        deliveryTempC: '145.0',
        breakdownTempC: '130.0',
        finishTempC: '90.0',
        inspectedBy: 'Eng. Auditor QA',
      },
    });
    expect(batchRes.statusCode).toBe(201);
    const batchId = JSON.parse(batchRes.payload).id;

    // 3. Mint JWT token with CLIENT role
    const clientToken = await loginToken(server, 'client@apexbuilders.co.ke');

    // -------------------------------------------------------------------------
    // A. Geotechnical soil tests (POST /soil-tests) -> MUST RETURN 403
    // -------------------------------------------------------------------------
    const soilRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/soil-tests`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        testNumber: `SOIL-SEC-${Date.now()}`,
        testDate: new Date().toISOString(),
        locationElement: 'Section 1',
        layerType: 'SUBGRADE',
        chainageStart: 'Ch 0+000',
        chainageEnd: 'Ch 0+100',
        laboratoryMddGCm3: '2.150',
        laboratoryOmcPercent: '12.50',
        fieldWetDensityGCm3: '2.200',
        fieldMoisturePercent: '11.80',
        requiredCompactionPercent: '95.00',
      },
    });
    expect(soilRes.statusCode).toBe(403);
    expect(JSON.parse(soilRes.payload).error).toBe('Forbidden');

    // -------------------------------------------------------------------------
    // B. Asphalt batches (POST /asphalt-batches) -> MUST RETURN 403
    // -------------------------------------------------------------------------
    const aspRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/asphalt-batches`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        ticketNumber: `ASP-UNAUTH-${Date.now()}`,
        supplierName: 'Colas Kenya',
        mixType: 'AC_14_WEARING',
        truckRegNo: 'KAA 002Z',
        tonnageTons: '25.00',
        chainageStart: 'Ch 0+200',
        chainageEnd: 'Ch 0+400',
        plantTempC: '160.0',
        deliveryTempC: '145.0',
        breakdownTempC: '130.0',
        finishTempC: '90.0',
      },
    });
    expect(aspRes.statusCode).toBe(403);
    expect(JSON.parse(aspRes.payload).error).toBe('Forbidden');

    // -------------------------------------------------------------------------
    // C. Asphalt core extraction test (PATCH /asphalt-batches/:id/core-test) -> MUST RETURN 403
    // -------------------------------------------------------------------------
    const coreRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/asphalt-batches/${batchId}/core-test`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        coreThicknessMm: '50.00',
        coreDensityGCm3: '2.350',
        marshallDensityGCm3: '2.400',
      },
    });
    expect(coreRes.statusCode).toBe(403);
    expect(JSON.parse(coreRes.payload).error).toBe('Forbidden');

    // -------------------------------------------------------------------------
    // D. Topographic surveys (POST /topographic-surveys) -> MUST RETURN 403
    // -------------------------------------------------------------------------
    const topoRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        surveyCode: `SURV-UNAUTH-${Date.now()}`,
        title: 'Unauthorized Client Survey',
        surveyorName: 'Client Surveyor',
        stations: [
          { stationIndex: 0, chainageMeters: '0.00', chainageLabel: 'Ch 0', existingGroundLevelM: '1800.0', proposedFormationLevelM: '1798.0' },
          { stationIndex: 1, chainageMeters: '50.00', chainageLabel: 'Ch 50', existingGroundLevelM: '1802.0', proposedFormationLevelM: '1798.0' },
        ],
      },
    });
    expect(topoRes.statusCode).toBe(403);
    expect(JSON.parse(topoRes.payload).error).toBe('Forbidden');

    // -------------------------------------------------------------------------
    // E. CAN-bus device registration (POST /canbus-devices) -> MUST RETURN 403
    // -------------------------------------------------------------------------
    const canbusRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/canbus-devices`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        equipmentId: equipment.id,
        deviceImei: `86${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
        canBusBaudRate: 250000,
      },
    });
    expect(canbusRes.statusCode).toBe(403);
    expect(JSON.parse(canbusRes.payload).error).toBe('Forbidden');

    // -------------------------------------------------------------------------
    // F. Legacy telematics device registration (POST /telematics-devices) -> MUST RETURN 403
    // -------------------------------------------------------------------------
    const telemRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/telematics-devices`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        equipmentId: equipment.id,
        deviceImei: `86${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
      },
    });
    expect(telemRes.statusCode).toBe(403);
    expect(JSON.parse(telemRes.payload).error).toBe('Forbidden');

    // -------------------------------------------------------------------------
    // G. Maintenance alert acknowledgement (PATCH /maintenance-alerts/:id/acknowledge) -> MUST RETURN 403
    // -------------------------------------------------------------------------
    const ackRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/maintenance-alerts/${alertId}/acknowledge`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        acknowledgedBy: 'Unauthorized Client User',
      },
    });
    expect(ackRes.statusCode).toBe(403);
    expect(JSON.parse(ackRes.payload).error).toBe('Forbidden');
  });

  it('SEC-03: IoT Webhook Token Verification & Anti-Spoofing Guard', async () => {
    const server = buildServer();

    // Authenticate PM/QS user
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    const { token } = JSON.parse(loginRes.payload);

    // Create Project & Equipment
    const projRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'IoT Security Test Corridor',
        code: `IOT-${Date.now().toString().slice(-4)}`,
        originalContractSum: 50000000,
        currentApprovedBudget: 50000000,
      },
    });
    const projectId = JSON.parse(projRes.payload).data.id;

    const equipRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/equipment`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Scania Tipper Truck',
        equipmentCode: `TRK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        equipmentType: 'TIPPER_TRUCK',
        registrationNo: 'KDL 999Y',
      },
    });
    expect(equipRes.statusCode).toBe(201);
    const equipmentId = JSON.parse(equipRes.payload).equipment.id;

    // Register CAN-bus Device with secret deviceToken
    const deviceImei = `86${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;
    const secretToken = `sec-tok-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const regRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/canbus-devices`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        equipmentId,
        deviceImei,
        deviceToken: secretToken,
        protocol: 'CANBUS',
      },
    });
    expect(regRes.statusCode).toBe(201);

    // 1. Unauthenticated ping with missing token -> MUST RETURN 401 Unauthorized
    const unauthRes = await server.inject({
      method: 'POST',
      url: '/api/v1/telematics/canbus-ping',
      payload: {
        deviceImei,
        latitude: '-1.286389',
        longitude: '36.817223',
        engineStatus: 'RUNNING',
        fuelLevelPercent: '80.00',
      },
    });
    expect(unauthRes.statusCode).toBe(401);
    expect(JSON.parse(unauthRes.payload).message).toContain('authentication token');

    // 2. Ping with incorrect token -> MUST RETURN 401 Unauthorized
    const wrongTokenRes = await server.inject({
      method: 'POST',
      url: '/api/v1/telematics/canbus-ping',
      headers: { authorization: 'Bearer wrong-device-token' },
      payload: {
        deviceImei,
        deviceToken: 'wrong-device-token',
        latitude: '-1.286389',
        longitude: '36.817223',
        engineStatus: 'RUNNING',
        fuelLevelPercent: '80.00',
      },
    });
    expect(wrongTokenRes.statusCode).toBe(401);

    // 3. Ping with matching valid token -> MUST RETURN 200 OK
    const validRes = await server.inject({
      method: 'POST',
      url: '/api/v1/telematics/canbus-ping',
      headers: { authorization: `Bearer ${secretToken}` },
      payload: {
        deviceImei,
        deviceToken: secretToken,
        latitude: '-1.286389',
        longitude: '36.817223',
        engineStatus: 'RUNNING',
        fuelLevelPercent: '80.00',
      },
    });
    expect(validRes.statusCode).toBe(200);
  });

  it('SEC-04: Input Validation & Numeric Overflow Prevention (400 Bad Request)', async () => {
    const server = buildServer();

    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    const { token } = JSON.parse(loginRes.payload);

    const projRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Validation Defense Corridor',
        code: `VAL-${Date.now().toString().slice(-4)}`,
        originalContractSum: 10000000,
        currentApprovedBudget: 10000000,
      },
    });
    const projectId = JSON.parse(projRes.payload).data.id;

    // 1. Zero-value bulkingFactor -> 400 Bad Request
    const zeroBulkingRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        surveyCode: `SURV-ZERO-${Date.now()}`,
        title: 'Zero Bulking Survey',
        surveyorName: 'Surv. John',
        bulkingFactor: '0',
        stations: [
          { stationIndex: 0, chainageMeters: '0.00', chainageLabel: 'Ch 0', existingGroundLevelM: '1800.0', proposedFormationLevelM: '1798.0' },
          { stationIndex: 1, chainageMeters: '50.00', chainageLabel: 'Ch 50', existingGroundLevelM: '1802.0', proposedFormationLevelM: '1798.0' },
        ],
      },
    });
    expect(zeroBulkingRes.statusCode).toBe(400);

    // 2. Negative bulkingFactor -> 400 Bad Request
    const negBulkingRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        surveyCode: `SURV-NEG-${Date.now()}`,
        title: 'Negative Bulking Survey',
        surveyorName: 'Surv. John',
        bulkingFactor: '-1.2',
        stations: [
          { stationIndex: 0, chainageMeters: '0.00', chainageLabel: 'Ch 0', existingGroundLevelM: '1800.0', proposedFormationLevelM: '1798.0' },
          { stationIndex: 1, chainageMeters: '50.00', chainageLabel: 'Ch 50', existingGroundLevelM: '1802.0', proposedFormationLevelM: '1798.0' },
        ],
      },
    });
    expect(negBulkingRes.statusCode).toBe(400);

    // 3. Scientific notation bulkingFactor string -> 400 Bad Request
    const sciBulkingRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        surveyCode: `SURV-SCI-${Date.now()}`,
        title: 'Scientific Notation Survey',
        surveyorName: 'Surv. John',
        bulkingFactor: '1e3',
        stations: [
          { stationIndex: 0, chainageMeters: '0.00', chainageLabel: 'Ch 0', existingGroundLevelM: '1800.0', proposedFormationLevelM: '1798.0' },
          { stationIndex: 1, chainageMeters: '50.00', chainageLabel: 'Ch 50', existingGroundLevelM: '1802.0', proposedFormationLevelM: '1798.0' },
        ],
      },
    });
    expect(sciBulkingRes.statusCode).toBe(400);

    // 4. Zero-value orderedVolumeM3 on RMC delivery -> 400 Bad Request
    const zeroRmcRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/rmc-deliveries`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        deliveryTicketNo: `RMC-ZERO-${Date.now()}`,
        supplierName: 'Bamburi',
        truckRegistrationNo: 'KAA 123B',
        concreteClass: 'CLASS_25_20',
        orderedVolumeM3: '0.00',
        dispatchedAt: new Date().toISOString(),
        pourLocationElement: 'Slab',
      },
    });
    expect(zeroRmcRes.statusCode).toBe(400);
  });

  it('SEC-05: Unique Constraint Conflict Handling (P2002 -> 409 Conflict)', async () => {
    const server = buildServer();

    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    const { token } = JSON.parse(loginRes.payload);

    const projRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'P2002 Conflict Test Corridor',
        code: `P2002-${Date.now().toString().slice(-4)}`,
        originalContractSum: 10000000,
        currentApprovedBudget: 10000000,
      },
    });
    const projectId = JSON.parse(projRes.payload).data.id;

    // 1. Create Topographic Survey
    const surveyCode = `SURV-P2002-${Date.now()}`;
    const firstSurveyRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        surveyCode,
        title: 'Original Survey',
        surveyorName: 'Surv. John',
        stations: [
          { stationIndex: 0, chainageMeters: '0.00', chainageLabel: 'Ch 0', existingGroundLevelM: '1800.0', proposedFormationLevelM: '1798.0' },
          { stationIndex: 1, chainageMeters: '50.00', chainageLabel: 'Ch 50', existingGroundLevelM: '1802.0', proposedFormationLevelM: '1798.0' },
        ],
      },
    });
    expect(firstSurveyRes.statusCode).toBe(201);

    // 2. Duplicate Survey Code -> MUST RETURN 409 Conflict (not 500)
    const dupSurveyRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/topographic-surveys`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        surveyCode,
        title: 'Duplicate Survey',
        surveyorName: 'Surv. John',
        stations: [
          { stationIndex: 0, chainageMeters: '0.00', chainageLabel: 'Ch 0', existingGroundLevelM: '1800.0', proposedFormationLevelM: '1798.0' },
          { stationIndex: 1, chainageMeters: '50.00', chainageLabel: 'Ch 50', existingGroundLevelM: '1802.0', proposedFormationLevelM: '1798.0' },
        ],
      },
    });
    expect(dupSurveyRes.statusCode).toBe(409);
    expect(JSON.parse(dupSurveyRes.payload).error).toBe('Conflict');
    expect(JSON.parse(dupSurveyRes.payload).message).toContain('already exists');

    // 3. Register Equipment for Duplicate CAN-bus Device test
    const equipRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/equipment`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Caterpillar Grader',
        equipmentCode: `EXC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        equipmentType: 'EXCAVATOR',
        registrationNo: 'KDM 111Z',
      },
    });
    expect(equipRes.statusCode).toBe(201);
    const equipmentId = JSON.parse(equipRes.payload).equipment.id;

    const dupImei = `86${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;
    const devToken = `tok-p2002-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const firstDevRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/canbus-devices`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        equipmentId,
        deviceImei: dupImei,
        deviceToken: devToken,
        protocol: 'CANBUS',
      },
    });
    expect(firstDevRes.statusCode).toBe(201);

    // Duplicate CAN-bus device with same IMEI / equipment -> MUST RETURN 409 Conflict
    const dupDevRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/canbus-devices`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        equipmentId,
        deviceImei: dupImei,
        deviceToken: `tok-p2002-second-${Date.now()}`,
        protocol: 'CANBUS',
      },
    });
    expect(dupDevRes.statusCode).toBe(409);
    expect(JSON.parse(dupDevRes.payload).error).toBe('Conflict');
    expect(JSON.parse(dupDevRes.payload).message).toContain('already exists');
  });
});
