import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

describe('Operations Suite: Schedule, Inventory, Safety, Documents & Subcontractors', () => {
  let server: FastifyInstance;
  let adminCookie: string;
  let supervisorCookie: string;
  let tenantId: string;
  let projectId: string;

  let scheduleTaskId: string;
  let inventoryItemId: string;

  beforeAll(async () => {
    server = buildServer();
    await server.ready();

    // 1. Login as Admin
    const adminLoginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(adminLoginRes.statusCode).toBe(200);
    const adminCookies = adminLoginRes.headers['set-cookie'];
    adminCookie = Array.isArray(adminCookies) ? adminCookies[0]! : (adminCookies as string);

    const adminBody = JSON.parse(adminLoginRes.body);
    tenantId = adminBody.user.tenant.id;

    // 2. Login as Site Supervisor
    const supLoginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'supervisor@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(supLoginRes.statusCode).toBe(200);
    const supCookies = supLoginRes.headers['set-cookie'];
    supervisorCookie = Array.isArray(supCookies) ? supCookies[0]! : (supCookies as string);

    // 3. Create or retrieve active project
    const projectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
      payload: {
        name: 'Kilimani Crest Executive Apartments',
        code: 'KCA-OPS-2026',
        description: 'Operations Suite Benchmark Project',
        location: 'Argwings Kodhek Rd, Nairobi',
        ncaProjectNo: 'NCA-PRJ-2026-9921',
        originalContractSum: 55000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    projectId = JSON.parse(projectRes.body).data.id;
  });

  afterAll(async () => {
    await withTenantTx(prisma, tenantId, async (tx) => {
      await tx.project.deleteMany({ where: { id: projectId } });
    });
    await server.close();
  });

  // ---------------------------------------------------------------------------
  // MODULE 1: PROJECT SCHEDULE & GANTT TASKS
  // ---------------------------------------------------------------------------
  describe('Module 1: Project Schedule & Gantt Tasks', () => {
    it('1.1 creates a scheduled task with WBS phase, dates, duration, and assigned trade', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/tasks`,
        headers: { cookie: adminCookie },
        payload: {
          wbsPhase: 'SUBSTRUCTURE',
          taskName: 'Excavation & Blinding to Strip Footings',
          description: 'Mechanical bulk excavation to depth 1.5m and 50mm mass concrete blinding',
          plannedStartDate: '2026-03-01',
          plannedEndDate: '2026-03-10',
          durationDays: 10,
          assignedTrade: 'Masons',
          orderIndex: 1,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      scheduleTaskId = body.id;
      expect(scheduleTaskId).toBeDefined();
      expect(body.wbs_phase).toBe('SUBSTRUCTURE');
      expect(body.task_name).toBe('Excavation & Blinding to Strip Footings');
      expect(body.status).toBe('PLANNED');
    });

    it('1.2 lists scheduled tasks and calculates summary analytics', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/tasks`,
        headers: { cookie: supervisorCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.tasks.length).toBeGreaterThan(0);
      expect(body.summary.totalTasks).toBeGreaterThanOrEqual(1);
      expect(body.summary.completedTasks).toBe(0);
    });

    it('1.3 updates task progress percentage and status to IN_PROGRESS', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${projectId}/tasks/${scheduleTaskId}`,
        headers: { cookie: supervisorCookie },
        payload: {
          progressPercentage: '45.00',
          status: 'IN_PROGRESS',
          actualStartDate: '2026-03-02',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('IN_PROGRESS');
      expect(Number(body.progress_percentage)).toBe(45);
    });
  });

  // ---------------------------------------------------------------------------
  // MODULE 2: SITE STORE INVENTORY & STOCK BALANCES
  // ---------------------------------------------------------------------------
  describe('Module 2: Site Store Inventory & Stock Reconciliation', () => {
    it('2.1 creates an inventory item with opening balance and minimum reorder level', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/inventory/items`,
        headers: { cookie: adminCookie },
        payload: {
          materialName: 'Simba Portland Cement 32.5N',
          category: 'CEMENT',
          unit: 'BAGS',
          openingBalance: '150.0000',
          minimumReorderLevel: '50.0000',
          unitCostEstimate: '750.00',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      inventoryItemId = body.id;
      expect(inventoryItemId).toBeDefined();
      expect(body.material_name).toBe('Simba Portland Cement 32.5N');
      expect(Number(body.current_stock)).toBe(150);
    });

    it('2.2 records inbound delivery movement (DELIVERY_IN), atomically increasing current stock', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/inventory/movements`,
        headers: { cookie: supervisorCookie },
        payload: {
          inventoryItemId,
          movementType: 'DELIVERY_IN',
          quantity: '100.0000',
          movementDate: '2026-03-03',
          referenceNo: 'DN-BAM-10492',
          notes: 'Received 100 bags 32.5N cement from Bamburi Athi River plant',
          recordedByName: 'John Kiprono',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.movement_type).toBe('DELIVERY_IN');
      expect(Number(body.updatedCurrentStock)).toBe(250); // 150 + 100
    });

    it('2.3 records material consumption (USAGE_OUT), atomically reducing current stock', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/inventory/movements`,
        headers: { cookie: supervisorCookie },
        payload: {
          inventoryItemId,
          movementType: 'USAGE_OUT',
          quantity: '75.0000',
          movementDate: '2026-03-04',
          referenceNo: 'REQ-POUR-001',
          notes: 'Issued to mixing gang for Grid 1-4 blinding pour',
          recordedByName: 'John Kiprono',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.movement_type).toBe('USAGE_OUT');
      expect(Number(body.updatedCurrentStock)).toBe(175); // 250 - 75
    });

    it('2.4 retrieves inventory overview with stock balances and movement audit history', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/inventory`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.summary.totalTrackedItems).toBe(1);
      expect(body.summary.lowStockCount).toBe(0); // 175 > 50
    });
  });

  // ---------------------------------------------------------------------------
  // MODULE 3: SAFETY & HSE INCIDENTS (OSHA 2007)
  // ---------------------------------------------------------------------------
  describe('Module 3: Safety & HSE Incident Management', () => {
    it('3.1 logs a safety incident with location, severity, and corrective action', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/safety-incidents`,
        headers: { cookie: supervisorCookie },
        payload: {
          incidentDate: '2026-03-05',
          incidentTime: '11:15',
          incidentType: 'PPE_VIOLATION',
          severity: 'MINOR',
          exactLocation: 'Scaffold Tower at Grid B-4',
          affectedPersonName: 'Francis Mwangi',
          affectedTrade: 'Plasterers',
          description: 'Worker observed working at height (3.2m) without chin-strap on helmet and harness unclipped.',
          immediateAction: 'Work halted immediately; worker equipped with full-body harness tied off to independent lifeline.',
          preventativeAction: 'Mandatory morning toolbox talk on Working at Height scheduled for all scaffolding and plastering gangs.',
          isOshaReportable: false,
          investigatedBy: 'John Kiprono (Site Supervisor)',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.incident_type).toBe('PPE_VIOLATION');
      expect(body.severity).toBe('MINOR');
      expect(body.is_osha_reportable).toBe(false);
    });

    it('3.2 retrieves safety incidents and compiles HSE statistics', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/safety-incidents`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.incidents.length).toBe(1);
      expect(body.summary.totalIncidents).toBe(1);
      expect(body.summary.ppeViolationsCount).toBe(1);
      expect(body.summary.oshaReportableCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // MODULE 4: PROJECT DOCUMENTS & DRAWINGS VAULT
  // ---------------------------------------------------------------------------
  describe('Module 4: Project Documents & Drawings Repository', () => {
    it('4.1 registers an architectural drawing with revision code and approval status', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/documents`,
        headers: { cookie: adminCookie },
        payload: {
          title: 'Ground Floor General Arrangement & Partitioning Layout',
          category: 'ARCHITECTURAL_DRAWING',
          drawingReference: 'A-101',
          revisionCode: 'Rev C',
          storageKey: 'drawings/kca-2026/A-101_Rev_C.pdf',
          status: 'APPROVED_FOR_CONSTRUCTION',
          uploadedByName: 'Arch. Peter Mwangi',
          notes: 'Issued for construction following County planning stamp approval.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.title).toBe('Ground Floor General Arrangement & Partitioning Layout');
      expect(body.category).toBe('ARCHITECTURAL_DRAWING');
      expect(body.revision_code).toBe('Rev C');
      expect(body.status).toBe('APPROVED_FOR_CONSTRUCTION');
    });

    it('4.2 lists documents grouped by category with active count', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/documents`,
        headers: { cookie: supervisorCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.documents.length).toBe(1);
      expect(body.summary.architecturalCount).toBe(1);
      expect(body.summary.structuralCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // MODULE 5: SUBCONTRACTOR WORK PACKAGES
  // ---------------------------------------------------------------------------
  describe('Module 5: Subcontractor Work Packages & Directory', () => {
    it('5.1 awards a subcontract package with subcontract sum and Kenyan retention terms', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/subcontractors`,
        headers: { cookie: adminCookie },
        payload: {
          tradeCategory: 'PLUMBING',
          firmName: 'Simba Plumbing Works Ltd',
          contactPerson: 'Eng. Dennis Otieno',
          phoneNumber: '+254722889900',
          subcontractSum: '2850000.00',
          retentionRatePct: '5.00',
          status: 'ACTIVE',
          scopeDescription: 'Internal sanitary drainage, PPR water supply reticulation, and rooftop storage tanks.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.firm_name).toBe('Simba Plumbing Works Ltd');
      expect(body.trade_category).toBe('PLUMBING');
      expect(Number(body.subcontract_sum)).toBe(2850000);
      expect(Number(body.retention_rate_pct)).toBe(5);
    });

    it('5.2 lists subcontractor packages and computes total commitments in Decimal', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/subcontractors`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.packages.length).toBe(1);
      expect(body.summary.activePackagesCount).toBe(1);
      expect(body.summary.totalCommitmentKes).toBe('2850000.00');
    });
  });

  // ---------------------------------------------------------------------------
  // MODULE 6: IMMUTABLE AUDIT TRAIL VERIFICATION
  // ---------------------------------------------------------------------------
  describe('Module 6: Operations Audit Trail Verification', () => {
    it('6.1 asserts that every operations action emitted an immutable audit log entry', async () => {
      const logs = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.auditLog.findMany({
          where: { project_id: projectId },
        });
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain('SCHEDULE_TASK_CREATED');
      expect(actions).toContain('SCHEDULE_TASK_UPDATED');
      expect(actions).toContain('INVENTORY_ITEM_CREATED');
      expect(actions).toContain('INVENTORY_MOVEMENT_RECORDED');
      expect(actions).toContain('SAFETY_INCIDENT_REPORTED');
      expect(actions).toContain('PROJECT_DOCUMENT_REGISTERED');
      expect(actions).toContain('SUBCONTRACTOR_PACKAGE_AWARDED');
    });
  });
});
