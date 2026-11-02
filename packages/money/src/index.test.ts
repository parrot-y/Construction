import { describe, expect, it } from 'vitest';
import {
  calculateBudgetConsumptionRatio,
  calculateLineTotal,
  evaluateProgressVariance,
  multiplyQuantityByRate,
  toCurrencyString,
  toDecimal,
} from './index';

describe('packages/money financial precision suite', () => {
  it('prevents IEEE 754 floating-point inaccuracies', () => {
    // In native JS: 0.1 + 0.2 === 0.30000000000000004
    const a = toDecimal('0.1');
    const b = toDecimal('0.2');
    const sum = a.plus(b);
    expect(sum.toString()).toBe('0.3');
    expect(toCurrencyString(sum)).toBe('0.30');
  });

  it('calculates line totals with fractional quantities and rates accurately', () => {
    // 14.3750 m3 of concrete at KES 1450.2550 per m3
    const qty = '14.3750';
    const rate = '1450.2550';
    const rawProduct = multiplyQuantityByRate(qty, rate);
    // 14.375 * 1450.255 = 20847.415625
    expect(rawProduct.toString()).toBe('20847.415625');

    // Rounded to cents via ROUND_HALF_UP -> 20847.42
    const total = calculateLineTotal(qty, rate);
    expect(total.toString()).toBe('20847.42');
    expect(toCurrencyString(total)).toBe('20847.42');
  });

  it('correctly implements ROUND_HALF_UP on currency boundaries', () => {
    expect(toCurrencyString('100.005')).toBe('100.01');
    expect(toCurrencyString('100.004')).toBe('100.00');
    expect(toCurrencyString('100.0050')).toBe('100.01');
    expect(toCurrencyString('100.0049')).toBe('100.00');
  });

  it('safely handles zero approved budget without throwing', () => {
    const ratio = calculateBudgetConsumptionRatio('500000', '0');
    expect(ratio.isZero()).toBe(true);
  });

  it('calculates budget consumption percentage accurately', () => {
    // Actual spend: KES 6,425,000 against Approved Budget: KES 12,850,000 -> 50%
    const ratio = calculateBudgetConsumptionRatio('6425000.00', '12850000.00');
    expect(ratio.toString()).toBe('0.5');
  });

  it('flags neutral variance warning when cost consumption is >= 15% ahead of physical progress', () => {
    // 70% cost consumption vs 45% physical progress (diff = 25% >= 15%)
    const result = evaluateProgressVariance('0.70', '0.45');
    expect(result.hasWarning).toBe(true);
    expect(result.message).toBe(
      'Cost consumption is significantly ahead of recorded physical progress. Review project costs and progress records.',
    );
    // Strict compliance check: Never use words like fraud, theft, or overbilled
    expect(result.message).not.toMatch(/fraud|theft|stolen|overbilled|cheat/i);
  });

  it('does not flag variance warning when within acceptable tolerance', () => {
    // 50% cost consumption vs 45% physical progress (diff = 5% < 15%)
    const result = evaluateProgressVariance('0.50', '0.45');
    expect(result.hasWarning).toBe(false);
    expect(result.message).toBeNull();
  });
});
