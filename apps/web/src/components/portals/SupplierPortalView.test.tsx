import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import SupplierPortalView from './SupplierPortalView';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * J3 — supplier portal on a phone: invoiced orders show "Invoice
 * submitted" with the reference (never a stale Submit invoice), and
 * finished orders / acknowledged deliveries collapse behind a count.
 */

const po = (over: any) => ({
  id: over.id,
  poNumber: over.poNumber,
  status: over.status,
  statusLabel: over.statusLabel || over.status,
  orderDate: '2026-11-01',
  expectedDeliveryDate: null,
  totalAmount: '500000.00',
  items: [{ id: 'it1', description: 'Cement 50kg', unit: 'bag', quantity: '100', rate: '5000' }],
  invoices: over.invoices || [],
});

const PAYLOAD = {
  data: {
    stakeholder: { name: 'Mombasa Hardware Ltd', vendorType: 'HARDWARE' },
    linkExpiresAt: '2027-01-01T00:00:00Z',
    project: { name: 'Riverside Commercial Plaza', code: 'RCP-001' },
    deliveries: [
      { id: 'd1', deliveryNote: 'EAC-DN-1', materialName: 'Steel bars', quantity: 10, unit: 'pc', deliveryStatus: 'PENDING', siteDate: '2026-11-10' },
      { id: 'd2', deliveryNote: 'EAC-DN-2', materialName: 'Cement', quantity: 50, unit: 'bag', deliveryStatus: 'CONFIRMED', siteDate: '2026-11-09' },
      { id: 'd3', deliveryNote: 'EAC-DN-3', materialName: 'Sand', quantity: 20, unit: 't', deliveryStatus: 'CONFIRMED', siteDate: '2026-11-08' },
    ],
    purchaseOrders: [
      po({ id: 'po1', poNumber: 'PO-1001', status: 'ACCEPTED', invoices: [
        { id: 'iv1', reference: 'INV/2026/0042', amount: '500000.00', status: 'REVIEW_REQUIRED', createdAt: '2026-11-12T00:00:00Z' },
      ] }),
      po({ id: 'po2', poNumber: 'PO-1002', status: 'DELIVERED' }),
      po({ id: 'po3', poNumber: 'PO-1003', status: 'ISSUED' }),
      po({ id: 'po4', poNumber: 'PO-1004', status: 'ACCEPTED', invoices: [
        { id: 'iv2', reference: 'INV/2026/0051', amount: '200000.00', status: 'SUBMITTED', createdAt: '2026-11-13T00:00:00Z' },
      ] }),
    ],
  },
};

async function renderPortal(): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SupplierPortalView token="tok-1" />);
    await new Promise((r) => setTimeout(r, 0));
  });
  return { container, root };
}

describe('SupplierPortalView — J3 states', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => PAYLOAD,
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fully-invoiced accepted PO shows "Invoice submitted" with reference, not Submit invoice', async () => {
    const { container, root } = await renderPortal();
    const html = container.innerHTML;
    expect(html).toContain('Invoice submitted');
    expect(html).toContain('INV/2026/0042');
    // PO-1001 must not offer another invoice — it is fully invoiced
    const card1 = container.querySelector('[data-testid="supplier-po-PO-1001"]')!;
    expect(card1.querySelector('[data-testid^="po-invoice-open-"]')).toBeNull();
    expect(card1.querySelector('[data-testid="po-invoice-submitted-PO-1001"]')).not.toBeNull();
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('partial invoice shows "Submit another invoice"; fully invoiced shows none', async () => {
    const { container, root } = await renderPortal();
    // PO-1004: 200k invoiced of 500k → action remains, relabelled.
    const card4 = container.querySelector('[data-testid="supplier-po-PO-1004"]')!;
    const openBtn = card4.querySelector('[data-testid="po-invoice-open-PO-1004"]') as HTMLButtonElement;
    expect(openBtn.textContent).toBe('Submit another invoice');
    // PO-1001: fully invoiced → no invoice action at all.
    const card1 = container.querySelector('[data-testid="supplier-po-PO-1001"]')!;
    expect(card1.querySelector('[data-testid^="po-invoice-open-"]')).toBeNull();
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('finished orders and acknowledged deliveries collapse behind counts', async () => {
    const { container, root } = await renderPortal();
    // PO-1002 (DELIVERED) is finished → collapsed; PO-1001 (ACCEPTED) stays visible
    expect(container.querySelector('[data-testid="supplier-po-PO-1002"]')).toBeNull();
    expect(container.querySelector('[data-testid="supplier-po-PO-1001"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="show-finished-pos-btn"]')?.textContent).toContain('1 completed order');

    // Confirmed deliveries collapse; the pending one stays in "Needs your action"
    expect(container.querySelector('[data-testid="show-confirmed-deliveries-btn"]')?.textContent).toContain('2 confirmed deliveries');
    const visibleDeliveryIds = [...container.querySelectorAll('[data-testid^="supplier-delivery-"]')].map((el) => el.getAttribute('data-testid'));
    expect(visibleDeliveryIds).toContain('supplier-delivery-EAC-DN-1');
    expect(visibleDeliveryIds).not.toContain('supplier-delivery-EAC-DN-2');

    // Expand and the finished PO + confirmed deliveries appear
    await act(async () => {
      (container.querySelector('[data-testid="show-finished-pos-btn"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="show-confirmed-deliveries-btn"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="supplier-po-PO-1002"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="supplier-delivery-EAC-DN-2"]')).not.toBeNull();
    await act(async () => { root.unmount(); });
    container.remove();
  });
});
