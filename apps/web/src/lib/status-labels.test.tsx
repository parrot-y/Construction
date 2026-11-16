import { describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { statusLabel } from './status-labels';
import { RetentionAndBondsView, type RetentionReleaseItem } from '../components/RetentionAndBondsView';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * J2 — raw status enums (ALL_CAPS_WITH_UNDERSCORE) must never reach the
 * screen; every money screen renders plain words, and actions the viewer's
 * role cannot perform are hidden or explained.
 */

describe('statusLabel helper', () => {
  it('maps every retention/certificate/invoice/variation/valuation enum to words', () => {
    expect(statusLabel('PENDING_QS_REVIEW')).toBe('Waiting for QS review');
    expect(statusLabel('QS_RECOMMENDED')).toBe('Recommended by QS — waiting for director');
    expect(statusLabel('APPROVED_BY_DIRECTOR')).toBe('Approved by director — ready to pay');
    expect(statusLabel('UNDER_REVIEW')).toBe('Under review');
    expect(statusLabel('PART_PAID')).toBe('Part paid');
    expect(statusLabel('OWNER_REVIEW')).toBe('Waiting for owner approval');
    expect(statusLabel('APPROVED_FOR_PAYMENT')).toBe('Approved for payment');
    expect(statusLabel('QS_VERIFIED')).toBe('QS verified');
  });

  it('never returns raw ALL_CAPS_WITH_UNDERSCORE for unknown values', () => {
    const out = statusLabel('SOME_FUTURE_STATUS');
    expect(out).not.toMatch(/^[A-Z0-9_]+$/);
    expect(out).toBe('Some future status');
    expect(statusLabel('')).toBe('—');
    expect(statusLabel(null)).toBe('—');
  });
});

const release = (over: Partial<RetentionReleaseItem>): RetentionReleaseItem => ({
  id: over.id || 'rel-x',
  releaseNo: 'RET-001',
  subcontractorPackageId: 'pkg-1',
  firmName: 'Test Electricals',
  tradeCategory: 'ELECTRICAL',
  moietyStage: 'FIRST_MOIETY_PRACTICAL_COMPLETION',
  totalRetentionHeld: '100000.00',
  releasePercentage: '50.00',
  releaseAmount: '50000.00',
  defectClearanceVerified: true,
  status: 'PENDING_QS_REVIEW',
  createdAt: '2026-11-01T00:00:00Z',
  ...over,
});

const ALL_STATUSES: RetentionReleaseItem[] = [
  release({ id: 'r1', status: 'PENDING_QS_REVIEW' }),
  release({ id: 'r2', status: 'QS_RECOMMENDED' }),
  release({ id: 'r3', status: 'APPROVED_BY_DIRECTOR' }),
  release({ id: 'r4', status: 'PAID', disbursementRef: 'MPESA-1' }),
  release({ id: 'r5', status: 'REJECTED' }),
];

async function render(el: React.ReactElement): Promise<string> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => { root.render(el); });
  const html = container.innerHTML;
  await act(async () => { root.unmount(); });
  container.remove();
  return html;
}

describe('retention console — plain words + role-gated actions', () => {
  it('renders no raw status enum and plain labels for every state', async () => {
    const html = await render(
      <RetentionAndBondsView releases={ALL_STATUSES} userRole="EXECUTIVE" />,
    );
    for (const raw of ['PENDING_QS_REVIEW', 'QS_RECOMMENDED', 'APPROVED_BY_DIRECTOR']) {
      expect(html, `raw enum ${raw} leaked`).not.toContain(raw);
    }
    expect(html).toContain('Waiting for QS review');
    expect(html).toContain('Recommended by QS');
    expect(html).toContain('Approved by director');
    expect(html).toContain('Paid');
    expect(html).toContain('Rejected');
  });

  it('a PM_QS sees QS actions but never a usable Director Approve', async () => {
    const html = await render(
      <RetentionAndBondsView releases={ALL_STATUSES} userRole="PM_QS" />,
    );
    expect(html).toContain('QS Recommend');
    expect(html).not.toContain('Director Approve');
    expect(html).toContain('Waiting for a director');
    expect(html).not.toContain('Disburse M-Pesa B2C');
  });

  it('a director sees Director Approve and Disburse', async () => {
    const html = await render(
      <RetentionAndBondsView releases={ALL_STATUSES} userRole="EXECUTIVE" />,
    );
    expect(html).toContain('Director Approve');
    expect(html).toContain('Disburse M-Pesa B2C');
  });

  it('a role outside the review chain sees an explanation, not buttons', async () => {
    const html = await render(
      <RetentionAndBondsView releases={ALL_STATUSES} userRole="SITE_SUPERVISOR" />,
    );
    expect(html).not.toContain('QS Recommend');
    expect(html).not.toContain('Director Approve');
    expect(html).toContain('QS or director review required');
  });
});

describe('money screens never render raw status enums (source gate)', () => {
  const dir = join(__dirname, '..', 'components');
  const screens = [
    'RetentionAndBondsView.tsx',
    'CertificatesCloseoutView.tsx',
    'InvoicingView.tsx',
    'VariationManagementView.tsx',
    'SubcontractorValuationView.tsx',
  ];
  for (const file of screens) {
    it(`${file} routes status display through statusLabel`, () => {
      const src = readFileSync(join(dir, file), 'utf8');
      // No JSX interpolation of a bare status value…
      expect(src).not.toMatch(/\{[a-zA-Z_.[\]]*\.status\}/);
      expect(src).not.toMatch(/\{status\}/);
      // …and no manual underscore-stripping on status fields.
      expect(src).not.toMatch(/\.status\.replace\(/);
      expect(src).not.toMatch(/paymentStatus\.replace\(/);
      expect(src).toContain('statusLabel');
    });
  }
});
