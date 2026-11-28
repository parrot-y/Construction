import { describe, expect, it, beforeAll, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import SubcontractorPortalView from './SubcontractorPortalView';
import CompliancePortalView from './CompliancePortalView';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null = null;

beforeAll(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  if (root) { await act(async () => { root!.unmount(); }); root = null; }
  container.innerHTML = '';
});

const render = async (el: React.ReactElement) => {
  root = createRoot(container);
  await act(async () => { root!.render(el); });
};

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } });

/**
 * 4aa0048 — portal money labels must come from data, not hard-coded rates:
 * the subcontractor retention ledger title renders the subcontract-sum-
 * weighted retention rate, and the compliance levy label carries no baked
 * "0.5%" figure.
 */
describe('portal data-driven rate labels (4aa0048)', () => {
  it('subcontractor retention ledger title shows the weighted rate, not a fixed 5%', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(url).toContain('/api/v1/portals/subcontractor/');
      return jsonResponse({
        stakeholder: { name: 'Mabati & Masonry Works Ltd', trade: 'MASONRY' },
        project: { name: 'Kileleshwa Residential Villas', code: 'KIL-RES-01' },
        snags: [],
        packages: [
          { id: 'p1', tradeCategory: 'MASONRY', subcontractSum: '100000.00', retentionRatePct: '5.00', valuations: [] },
          { id: 'p2', tradeCategory: 'ROOFING', subcontractSum: '300000.00', retentionRatePct: '10.00', valuations: [] },
        ],
      });
    }));

    await render(<SubcontractorPortalView token="tok-sub" />);
    // (5*100k + 10*300k) / 400k = 8.75 — first package alone would show 5.
    expect(container.textContent).toContain('8.75% Retention Ledger');
    // "8.75%" ends in "5%" — guard the digit before the rate.
    expect(container.textContent).not.toMatch(/[^0-9.]5% Retention Ledger/);
  });

  it('compliance portal levy label has no hard-coded percentage', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(url).toContain('/api/v1/portals/compliance/');
      return jsonResponse({
        project: { name: 'Kileleshwa Residential Villas', code: 'KIL-RES-01' },
        complianceSummary: {
          ncaSiteRegistration: 'NCA/2026/0441',
          statutoryLevyPaid: true,
          certifiedSiteSupervisorPresent: true,
          concreteCubePassRate: '100%',
          totalBatchesSampled: 4,
          prePourInspectionsConducted: 4,
        },
        cubeTests: [],
        inspections: [],
        certificates: [],
      });
    }));

    await render(<CompliancePortalView token="tok-comp" />);
    expect(container.textContent).toContain('Statutory Levy');
    expect(container.textContent).not.toContain('0.5% Statutory Levy');
    expect(container.textContent).not.toContain('0.5%');
  });
});
