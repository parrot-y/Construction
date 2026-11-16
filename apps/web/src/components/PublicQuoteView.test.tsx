import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PublicQuoteView from './PublicQuoteView';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * K3 — the public quote page must render every amount through the shared
 * money helper: "KES 2,400,000.00", never a bare 2400000 digit run, and
 * the Subtotal/Tax/Total/Deposit lines keep a space after the colon.
 */

const QUOTE = {
    quote: {
      id: 'q1', quote_no: 42, title: 'Office fit-out', client_name: 'Delta Properties Ltd',
      status: 'SENT', currency: 'KES', subtotal: '4200000.00', tax_pct: '16',
      tax_amount: '672000.00', total: '4872000.00', deposit_pct: '30',
      deposit_amount: '1461600.00', valid_until: null, items: [
        { id: 'i1', description: 'Partition walls', unit: 'sum', quantity: '1', unit_rate: '2400000.00', total_amount: '2400000.00' },
        { id: 'i2', description: 'Ceiling works', unit: 'sum', quantity: '1', unit_rate: '1800000.00', total_amount: '1800000.00' },
      ],
    },
    contractor: { name: 'Syokimau Builders Ltd' },
};

async function renderQuote() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<PublicQuoteView token="tok" />);
    await new Promise((r) => setTimeout(r, 0));
  });
  return { container, root };
}

describe('PublicQuoteView — money formatting', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => QUOTE }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders every amount with thousands separators and spaced colons', async () => {
    const { container, root } = await renderQuote();
    const html = container.innerHTML;

    // No unseparated money: "KES 2400000" or a bare 7-digit run fails.
    expect(html).not.toMatch(/KES\s+-?\d{4,}(?![\d,])/);
    expect(html).not.toContain('>2400000<');
    expect(html).not.toContain('>1800000<');

    // Shared helper output present for rate, line, subtotal, tax, total, deposit.
    expect(html).toContain('KES 2,400,000.00');
    expect(html).toContain('KES 1,800,000.00');
    expect(html).toContain('KES 4,872,000.00');
    expect(html).toContain('KES 1,461,600.00');

    // Space after the colon on the totals lines.
    expect(html).toContain('Subtotal: <span');
    expect(html).toContain('Total: <span');
    expect(html).toContain('Deposit required (30%): <span');
    expect(html).not.toContain('Subtotal:<span');
    expect(html).not.toContain('Total:<span');

    await act(async () => { root.unmount(); });
    container.remove();
  });
});
