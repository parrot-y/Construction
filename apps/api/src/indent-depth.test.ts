import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

// CB1 — indent depth (Assistant QS competitive gap):
// store/floor/unit/work-order targeting, MATERIAL vs SERVICE kind,
// delivery schedule batches, lead time, amend-material workflow,
// fulfilment buckets derived from linked POs and issue movements.
describe('CB1 — material indent depth', () => {
  const server = buildServer();

  let adminCookie: string;
  let tenantId: string;
  let projectId: string;
  let inventoryItemId: string;
  let materialReqId: string;
  let serviceReqId: string;

  const authed = () => ({ cookie: adminCookie });

  const createRequisition = async (overrides: Record<string, any> = {}) => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/material-requisitions`,
      headers: authed(),
      payload: {
        requisitionNo: `REQ-CB1-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 999)}`,
        itemDescription: 'Ballast 20mm',
        unitOfMeasure: 'm3',
        requestedQuantity: '12.00',
        estimatedUnitCostKes: '2800.00',
        requestedBy: 'Site Foreman',
        ...overrides,
      },
    });
    return res;
  };

  beforeAll(async () => {
    await server.ready();

    const login = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    adminCookie = login.headers['set-cookie'] as string;
    tenantId = JSON.parse(login.body).user.tenant.id;

    const proj = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: authed(),
      payload: {
        name: 'CB1 Indent Depth Tower',
        code: `CB1-${Date.now().toString().slice(-4)}`,
        location: 'Kilimani, Nairobi',
        originalContractSum: 80000000,
      },
    });
    expect(proj.statusCode).toBe(201);
    projectId = JSON.parse(proj.body).data.id;

    const item = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/inventory/items`,
      headers: authed(),
      payload: {
        materialName: 'Ballast 20mm',
        category: 'AGGREGATES',
        unit: 'M3',
        openingBalance: '50.0000',
        minimumReorderLevel: '5.0000',
      },
    });
    expect(item.statusCode).toBe(201);
    inventoryItemId = JSON.parse(item.body).id;
  });

  it('creates a MATERIAL indent with store/floor/unit/work-order targeting and delivery batches', async () => {
    const res = await createRequisition({
      indentKind: 'MATERIAL',
      storeLocation: 'Nairobi Main Store',
      floorRef: 'Level 3',
      unitRef: 'Unit 12B',
      workOrderRef: 'WO-STR-014',
      indentCategory: 'STRUCTURAL',
      materialType: 'Aggregate',
      materialSubType: 'Ballast',
      leadTimeDays: 3,
      expectedDeliveryDate: '2026-12-01',
      notes: 'Pour window Friday',
      inventoryItemId,
      deliverySchedule: [
        { batchDate: '2026-11-28', quantity: '6.00' },
        { batchDate: '2026-12-01', quantity: '6.00' },
      ],
    });
    expect(res.statusCode, res.body).toBe(201);
    const body = JSON.parse(res.body);
    materialReqId = body.requisition?.id ?? body.data?.id ?? body.id;
    expect(materialReqId).toBeTruthy();

    const list = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/material-requisitions`,
      headers: authed(),
    });
    expect(list.statusCode).toBe(200);
    const row = (JSON.parse(list.body).requisitions as any[]).find((r) => r.id === materialReqId);
    expect(row, 'requisition row in list').toBeTruthy();
    expect(row.indentKind).toBe('MATERIAL');
    expect(row.storeLocation).toBe('Nairobi Main Store');
    expect(row.floorRef).toBe('Level 3');
    expect(row.unitRef).toBe('Unit 12B');
    expect(row.workOrderRef).toBe('WO-STR-014');
    expect(row.indentCategory).toBe('STRUCTURAL');
    expect(row.materialType).toBe('Aggregate');
    expect(row.materialSubType).toBe('Ballast');
    expect(row.leadTimeDays).toBe(3);
    expect(row.expectedDeliveryDate).toBe('2026-12-01');
    expect(row.fulfilment).toBe('UNFULFILLED');
    expect(row.deliverySchedule).toHaveLength(2);
    expect(row.deliverySchedule[0].quantity).toBe('6.00');
  });

  it('creates a SERVICE indent and filters by kind', async () => {
    const res = await createRequisition({
      requisitionNo: `REQ-CB1-SVC-${Date.now().toString().slice(-6)}`,
      indentKind: 'SERVICE',
      itemDescription: 'Concrete pump hire — 2 days',
      unitOfMeasure: 'day',
      requestedQuantity: '2.00',
      estimatedUnitCostKes: '85000.00',
      workOrderRef: 'WO-CONC-021',
      indentCategory: 'SERVICES',
    });
    expect(res.statusCode, res.body).toBe(201);
    const body = JSON.parse(res.body);
    serviceReqId = body.requisition?.id ?? body.data?.id ?? body.id;

    const svc = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/material-requisitions?indentKind=SERVICE`,
      headers: authed(),
    });
    const svcRows = JSON.parse(svc.body).requisitions as any[];
    expect(svcRows.length).toBeGreaterThanOrEqual(1);
    expect(svcRows.every((r) => r.indentKind === 'SERVICE')).toBe(true);
    expect(svcRows.some((r) => r.id === serviceReqId)).toBe(true);
    expect(svcRows.some((r) => r.id === materialReqId)).toBe(false);

    const mat = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/material-requisitions?indentKind=MATERIAL`,
      headers: authed(),
    });
    const matRows = JSON.parse(mat.body).requisitions as any[];
    expect(matRows.every((r) => r.indentKind === 'MATERIAL')).toBe(true);
  });

  it('derives fulfilment: PO link -> PO_RAISED -> PO_FULFILLED; issue -> ISSUED -> FULFILLED', async () => {
    // Approve the material indent, then raise a PO against it.
    const approve = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/material-requisitions/${materialReqId}`,
      headers: authed(),
      payload: { status: 'APPROVED', approvedBy: 'QS Officer' },
    });
    expect(approve.statusCode, approve.body).toBe(200);

    const po = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/purchase-orders`,
      headers: authed(),
      payload: {
        supplierName: 'Mombasa Ballast Suppliers Ltd',
        notes: 'Against indent REQ-CB1',
        requisitionId: materialReqId,
        items: [{ description: 'Ballast 20mm', unit: 'm3', quantity: 12, rate: 2800 }],
      },
    });
    expect(po.statusCode, po.body).toBe(201);
    const poId = JSON.parse(po.body).data?.id ?? JSON.parse(po.body).id;

    const list1 = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/material-requisitions`,
      headers: authed(),
    });
    let row = (JSON.parse(list1.body).requisitions as any[]).find((r) => r.id === materialReqId);
    expect(row.fulfilment).toBe('PO_RAISED');
    expect(row.linkedPurchaseOrderId).toBe(poId);

    // PO delivered -> PO_FULFILLED (direct status move for fixture speed).
    await withTenantTx(prisma, tenantId, (tx) =>
      tx.purchaseOrder.update({ where: { id: poId }, data: { status: 'DELIVERED' } }),
    );

    const list2 = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/material-requisitions`,
      headers: authed(),
    });
    row = (JSON.parse(list2.body).requisitions as any[]).find((r) => r.id === materialReqId);
    expect(row.fulfilment).toBe('PO_FULFILLED');

    // Partial issue -> ISSUED.
    const mv1 = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/inventory/movements`,
      headers: authed(),
      payload: {
        inventoryItemId,
        movementType: 'USAGE_OUT',
        quantity: '5.0000',
        movementDate: '2026-11-30',
        referenceNo: 'ISS-CB1-1',
        recordedByName: 'Store Keeper',
        requisitionId: materialReqId,
      },
    });
    expect(mv1.statusCode, mv1.body).toBe(201);

    const list3 = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/material-requisitions`,
      headers: authed(),
    });
    row = (JSON.parse(list3.body).requisitions as any[]).find((r) => r.id === materialReqId);
    expect(row.fulfilment).toBe('ISSUED');
    expect(row.issuedQuantity).toBe('5.0000');

    // Issue the remainder -> FULFILLED.
    const mv2 = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/inventory/movements`,
      headers: authed(),
      payload: {
        inventoryItemId,
        movementType: 'USAGE_OUT',
        quantity: '7.0000',
        movementDate: '2026-12-01',
        referenceNo: 'ISS-CB1-2',
        recordedByName: 'Store Keeper',
        requisitionId: materialReqId,
      },
    });
    expect(mv2.statusCode, mv2.body).toBe(201);

    const list4 = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/material-requisitions`,
      headers: authed(),
    });
    row = (JSON.parse(list4.body).requisitions as any[]).find((r) => r.id === materialReqId);
    expect(row.fulfilment).toBe('FULFILLED');

    // Bucket filter.
    const bucketed = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/material-requisitions?fulfilment=FULFILLED`,
      headers: authed(),
    });
    const bucketRows = JSON.parse(bucketed.body).requisitions as any[];
    expect(bucketRows.every((r) => r.fulfilment === 'FULFILLED')).toBe(true);
    expect(bucketRows.some((r) => r.id === materialReqId)).toBe(true);
    expect(bucketRows.some((r) => r.id === serviceReqId)).toBe(false);
  });

  it('amends material fields and delivery schedule with a reason; blocks amend when fulfilled', async () => {
    // Amend the service indent (still unfulfilled).
    const amend = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/material-requisitions/${serviceReqId}/amend`,
      headers: authed(),
      payload: {
        reason: 'Pump hire extended to 3 days per revised pour program',
        itemDescription: 'Concrete pump hire — 3 days',
        requestedQuantity: '3.00',
        estimatedUnitCostKes: '85000.00',
        expectedDeliveryDate: '2026-12-03',
        deliverySchedule: [{ batchDate: '2026-12-02', quantity: '3.00' }],
      },
    });
    expect(amend.statusCode, amend.body).toBe(200);

    const list = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/material-requisitions`,
      headers: authed(),
    });
    const row = (JSON.parse(list.body).requisitions as any[]).find((r) => r.id === serviceReqId);
    expect(row.itemDescription).toBe('Concrete pump hire — 3 days');
    expect(row.requestedQuantity).toBe('3.00');
    expect(row.expectedDeliveryDate).toBe('2026-12-03');
    expect(row.deliverySchedule).toHaveLength(1);
    expect(row.deliverySchedule[0].batchDate).toBe('2026-12-02');

    // Amend requires a reason.
    const noReason = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/material-requisitions/${serviceReqId}/amend`,
      headers: authed(),
      payload: { itemDescription: 'No reason amend' },
    });
    expect(noReason.statusCode).toBe(400);

    // Amend on FULFILLED requisition is refused.
    const late = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/material-requisitions/${materialReqId}/amend`,
      headers: authed(),
      payload: { reason: 'Too late', itemDescription: 'Should fail' },
    });
    expect(late.statusCode).toBe(409);
  });

  it('rejects invalid delivery schedule quantities', async () => {
    const res = await createRequisition({
      deliverySchedule: [{ batchDate: '2026-12-01', quantity: '0' }],
    });
    expect(res.statusCode).toBe(400);
  });
});
