import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withTenantTx } from '@construction/db';
import { buildServer } from './index';
import { enrollAllTenantUsers } from './test-members';

describe('Milestones M16, M17 & M18: Site Operations, Plant Utilization & Siphoning, Labor Muster Roll & Safety Audits', () => {
  const server = buildServer();
  let tenantId = 'e460c1cc-67a5-408c-841d-ed28280a44f2'; // Apex Builders Kenya Ltd
  let adminCookie: string;
  let supervisorCookie: string;
  let projectId: string;
  let equipmentId: string;
  let laborerId: string;
  let musterRollId: string;
  const testNationalId = '298' + Math.floor(10000 + Math.random() * 90000);
  const testWorkerCode = 'LAB-' + Math.floor(1000 + Math.random() * 9000);

  beforeAll(async () => {
    await server.ready();

    const apex = await prisma.tenant.findFirst({ where: { name: 'Apex Builders Kenya Ltd' } });
    if (apex) tenantId = apex.id;

    // 1. Authenticate as Company Admin (PM/QS authority)
    const adminLogin = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(adminLogin.statusCode).toBe(200);
    adminCookie = adminLogin.headers['set-cookie'] as string;

    // 2. Authenticate as Site Supervisor
    const superLogin = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'supervisor@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(superLogin.statusCode).toBe(200);
    supervisorCookie = superLogin.headers['set-cookie'] as string;

    // 3. Create active test project
    const projectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
      payload: {
        name: 'Kilimani Highrise Heavy Site Operations Test',
        code: `KIL-${Date.now().toString().slice(-4)}`,
        location: 'Argwings Kodhek, Kilimani, Nairobi',
        originalContractSum: 185000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    projectId = JSON.parse(projectRes.body).data.id;
    await enrollAllTenantUsers(projectId);
  });

  afterAll(async () => {
    if (projectId) {
      await withTenantTx(prisma, tenantId, async (tx) => {
        await tx.safetyAuditRecord.deleteMany({ where: { project_id: projectId } });
        await tx.laborDailyAttendance.deleteMany({ where: { project_id: projectId } });
        await tx.laborMusterRoll.deleteMany({ where: { project_id: projectId } });
        await tx.siteLaborer.deleteMany({ where: { project_id: projectId } });
        await tx.plantEquipmentDailyLog.deleteMany({ where: { project_id: projectId } });
        await tx.plantEquipment.deleteMany({ where: { project_id: projectId } });
        await tx.project.deleteMany({ where: { id: projectId } });
      });
    }
    await server.close();
  });

  // =========================================================================
  // TEST SUITE 1: PLANT & HEAVY EQUIPMENT TRACKING & FUEL AUDITING (M16)
  // =========================================================================
  describe('Milestone M16: Plant Equipment, Daily Utilization & Fuel Siphoning Audit', () => {
    it('registers heavy machinery with rate and opening hours meter', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/equipment`,
        headers: { cookie: supervisorCookie },
        payload: {
          equipmentCode: 'EXC-001',
          name: 'CAT 320D Hydraulic Excavator',
          equipmentType: 'EXCAVATOR',
          ownershipType: 'HIRED_WET',
          ratePerUnitKes: '6500.00',
          rateUnit: 'PER_HOUR',
          registrationNo: 'KDF 819B',
          supplierName: 'Simba Heavy Plant Hire Ltd',
          currentHoursMeter: '1420.50',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.equipment.equipmentCode).toBe('EXC-001');
      expect(body.equipment.status).toBe('OPERATIONAL');
      equipmentId = body.equipment.id;
    });

    it('lists plant equipment and calculates operational count', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/equipment`,
        headers: { cookie: supervisorCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalEquipment).toBeGreaterThanOrEqual(1);
      expect(body.summary.operationalCount).toBeGreaterThanOrEqual(1);
      expect(body.equipment.some((e: any) => e.equipmentCode === 'EXC-001')).toBe(true);
    });

    it('logs normal equipment daily hours and fuel consumption (burn rate normal)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/equipment-logs`,
        headers: { cookie: supervisorCookie },
        payload: {
          equipmentId,
          logDate: '2026-11-03',
          operatorName: 'Peter Kamau Mwangi',
          openingHoursMeter: '1420.50',
          closingHoursMeter: '1428.50',
          operatingHours: '8.00',
          idleOrBreakdownHours: '0.50',
          fuelLitersIssued: '96.00', // 96 / 8 = 12 L/hr (Normal)
          fuelCostPerLiterKes: '185.00',
          activitiesPerformed: 'Basement raft foundation trench excavation and spoil heap loading',
          verifiedBySupervisor: 'Eng. John Mwangi',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.log.operatingHours).toBe('8.00');
      expect(body.log.fuelBurnLitersPerHour).toBe('12.00');
      expect(body.log.fuelEfficiencyStatus).toBe('NORMAL');
      expect(body.log.totalFuelCostKes).toBe('17760.00');
    });

    it('flags suspected diesel siphoning when fuel burn exceeds threshold (>25 L/hr)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/equipment-logs`,
        headers: { cookie: supervisorCookie },
        payload: {
          equipmentId,
          logDate: '2026-11-04',
          operatorName: 'Peter Kamau Mwangi',
          openingHoursMeter: '1428.50',
          closingHoursMeter: '1430.50',
          operatingHours: '2.00',
          idleOrBreakdownHours: '6.00',
          fuelLitersIssued: '90.00', // 90 / 2 = 45 L/hr (Suspicious siphoning flag)
          fuelCostPerLiterKes: '185.00',
          activitiesPerformed: 'Idle standby on site with brief ramp clearing',
          verifiedBySupervisor: 'Eng. John Mwangi',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.log.operatingHours).toBe('2.00');
      expect(body.log.fuelBurnLitersPerHour).toBe('45.00');
      expect(body.log.fuelEfficiencyStatus).toBe('SUSPECTED_SIPHONING');
    });
  });

  // =========================================================================
  // TEST SUITE 2: SITE CASUAL LABOR MUSTER ROLL & ARTISAN WAGE PAYROLL (M17)
  // =========================================================================
  describe('Milestone M17: Site Casual Labor Muster Roll & Artisan Wage Payroll with National ID Verification', () => {
    it('registers an artisan worker with Kenyan National ID and trade', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/laborers`,
        headers: { cookie: supervisorCookie },
        payload: {
          workerCode: testWorkerCode,
          fullName: 'Juma Otieno Ochieng',
          nationalIdNo: testNationalId,
          phoneNumber: '+254711223344',
          tradeCategory: 'MASON',
          skillLevel: 'ARTISAN_FUNDI',
          dailyRateKes: '1600.00',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.laborer.fullName).toBe('Juma Otieno Ochieng');
      expect(body.laborer.dailyRateKes).toBe('1600.00');
      laborerId = body.laborer.id;
    });

    it('lists site laborers with trade category and skill breakdown', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/laborers`,
        headers: { cookie: supervisorCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalWorkers).toBeGreaterThanOrEqual(1);
      expect(body.summary.fundisCount).toBeGreaterThanOrEqual(1);
      expect(body.laborers.some((l: any) => l.nationalIdNo === testNationalId)).toBe(true);
    });

    it('creates weekly muster roll with attendance days and overtime computation', async () => {
      // Worker daily rate: 1600 KES
      // Days worked: 5 -> 5 * 1600 = 8000 KES
      // Overtime: 4 hours -> (1600 / 8) * 1.5 * 4 = 200 * 1.5 * 4 = 1200 KES
      // Total Gross / Net: 9200 KES
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/muster-rolls`,
        headers: { cookie: supervisorCookie },
        payload: {
          payrollNo: `MR-WK44-${Date.now().toString().slice(-4)}`,
          weekEndingDate: '2026-11-06',
          notes: 'Week 44 superstructure concrete column casting & blockwork casual crew',
          attendances: [
            {
              laborerId,
              attendanceDate: '2026-11-06',
              daysWorked: '5.00',
              overtimeHours: '4.00',
              taskAssigned: 'Block wall laying on Level 3 and curing',
              verifiedBy: 'Eng. John Mwangi (Site Supervisor)',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.musterRoll.totalWorkers).toBe(1);
      expect(body.musterRoll.totalManDays).toBe('5.00');
      expect(body.musterRoll.netWagesPayableKes).toBe('9200.00');
      expect(body.musterRoll.status).toBe('PENDING_VERIFICATION');
      musterRollId = body.musterRoll.id;
    });

    it('lists muster rolls with weekly summaries', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/muster-rolls`,
        headers: { cookie: supervisorCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalMusterRolls).toBeGreaterThanOrEqual(1);
      expect(body.summary.pendingVerificationCount).toBeGreaterThanOrEqual(1);
    });

    it('allows QS to approve and disburse wage muster roll with M-Pesa reference', async () => {
      // 1. QS Approval
      const approveRes = await server.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${projectId}/muster-rolls/${musterRollId}`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'QS_APPROVED',
          approvedBy: 'Arch. David Muthomi (QS)',
        },
      });
      expect(approveRes.statusCode).toBe(200);
      expect(JSON.parse(approveRes.body).musterRoll.status).toBe('QS_APPROVED');

      // 2. M-Pesa B2C Bulk Disbursement
      const disburseRes = await server.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${projectId}/muster-rolls/${musterRollId}`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'DISBURSED',
          disbursementReference: 'MPESA-B2C-PAYROLL-9928174',
        },
      });
      expect(disburseRes.statusCode).toBe(200);
      const body = JSON.parse(disburseRes.body);
      expect(body.musterRoll.status).toBe('DISBURSED');
      expect(body.musterRoll.disbursementReference).toBe('MPESA-B2C-PAYROLL-9928174');
    });
  });

  // =========================================================================
  // TEST SUITE 3: FIELD SAFETY AUDITS & DOSHS/NCA COMPLIANCE SCORECARDS (M18)
  // =========================================================================
  describe('Milestone M18: Field Safety Audits & DOSHS/NCA Compliance Scorecards', () => {
    it('records a satisfactory field safety audit with high compliance score', async () => {
      // Weights: PPE (40%), Scaffolding (20%), Excavation (20%), First Aid/Fire (10%), Electrical (10%)
      // PPE: 95 * 0.40 = 38.0
      // Scaffolding: PASS = 20
      // Excavation: PASS = 20
      // First Aid: PASS = 10
      // Electrical: PASS = 10
      // Overall: 38 + 20 + 20 + 10 + 10 = 98.0
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/safety-audits`,
        headers: { cookie: supervisorCookie },
        payload: {
          auditNo: `SAF-2026-${Date.now().toString().slice(-4)}`,
          auditDate: '2026-11-03',
          auditorName: 'HSE Officer Wanjiku Kariuki',
          auditorType: 'INTERNAL_SAFETY_OFFICER',
          ppeComplianceScore: '95.00',
          scaffoldingAndEdgeProtectionStatus: 'PASS',
          excavationAndShoringStatus: 'PASS',
          firstAidAndFireStationStatus: 'PASS',
          electricalSafetyAndCablesStatus: 'PASS',
          correctiveActionPlan: 'Maintain daily toolbox talks on safety harness anchorage',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.audit.overallComplianceScore).toBe('98.00');
      expect(body.audit.auditOutcome).toBe('SATISFACTORY');
      expect(body.audit.status).toBe('CLOSED');
      expect(body.audit.id).toBeDefined();
    });

    it('triggers STOP_ORDER_ISSUED when scaffolding or excavation fails critical check', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/safety-audits`,
        headers: { cookie: supervisorCookie },
        payload: {
          auditNo: `SAF-NCA-${Date.now().toString().slice(-4)}`,
          auditDate: '2026-11-04',
          auditorName: 'Eng. K. Njoroge (NCA Inspectorate)',
          auditorType: 'NCA_INSPECTOR',
          ppeComplianceScore: '65.00',
          scaffoldingAndEdgeProtectionStatus: 'FAIL_STOP_WORK', // Critical violation
          excavationAndShoringStatus: 'MINOR_DEFECTS',
          firstAidAndFireStationStatus: 'DEFICIENT',
          electricalSafetyAndCablesStatus: 'PASS',
          correctiveActionPlan: 'Erect proper toe boards and safety netting on Level 4 scaffolding before resumption',
          reinspectionDueDate: '2026-11-07',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.audit.auditOutcome).toBe('STOP_ORDER_ISSUED');
      expect(body.audit.status).toBe('OPEN');
    });

    it('lists safety audits with overall project compliance metrics', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/safety-audits`,
        headers: { cookie: supervisorCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalAudits).toBe(2);
      expect(body.summary.passCount).toBe(1);
      expect(body.summary.stopOrdersCount).toBe(1);
      expect(Number(body.summary.averageComplianceScorePct)).toBeGreaterThan(0);
      expect(body.audits.length).toBe(2);
    });
  });
});
