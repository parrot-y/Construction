import { describe, expect, it } from 'vitest';
import {
  calculateBudgetConsumptionRatio,
  calculateDetailedVariance,
  calculateLineTotal,
  calculateSectionVariance,
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

  describe('calculateDetailedVariance (Milestone M7)', () => {
    it('returns ACTION_REQUIRED when disparity >= 15%', () => {
      const res = calculateDetailedVariance('0.72', '0.40');
      expect(res.status).toBe('ACTION_REQUIRED');
      expect(res.severity).toBe('critical');
      expect(res.hasWarning).toBe(true);
      expect(res.statusLabel).toBe('Significant Disparity');
      expect(res.costConsumptionPercentage).toBe('72.00');
      expect(res.physicalProgressPercentage).toBe('40.00');
      expect(res.differencePercentage).toBe('+32.00%');
      expect(res.message).toBe(
        'Cost consumption is significantly ahead of recorded physical progress. Review project costs and progress records.',
      );
      expect(res.message).not.toMatch(/fraud|theft|stolen|loss|bleeding|overcharge/i);
    });

    it('returns ATTENTION when disparity is between 0% and 15%', () => {
      const res = calculateDetailedVariance('0.48', '0.40');
      expect(res.status).toBe('ATTENTION');
      expect(res.severity).toBe('warning');
      expect(res.hasWarning).toBe(false);
      expect(res.statusLabel).toBe('Moderate Disparity');
      expect(res.differencePercentage).toBe('+8.00%');
      expect(res.message).toContain('moderately ahead');
    });

    it('returns ON_TRACK when physical progress meets or exceeds cost consumption', () => {
      const res = calculateDetailedVariance('0.35', '0.40');
      expect(res.status).toBe('ON_TRACK');
      expect(res.severity).toBe('info');
      expect(res.hasWarning).toBe(false);
      expect(res.statusLabel).toBe('Normal Alignment');
      expect(res.differencePercentage).toBe('-5.00%');
      expect(res.message).toBe('Expenditure is aligned with recorded physical progress.');
    });
  });

  describe('calculateSectionVariance (Milestone M7)', () => {
    it('computes NORMAL status when consumption is under 85%', () => {
      const res = calculateSectionVariance('1000000', '650000', '50000');
      expect(res.allocatedBudget).toBe('1000000.00');
      expect(res.actualSpent).toBe('650000.00');
      expect(res.pendingSpent).toBe('50000.00');
      expect(res.remainingBudget).toBe('350000.00');
      expect(res.consumptionPercentage).toBe('65.00');
      expect(res.isOverBudget).toBe(false);
      expect(res.status).toBe('NORMAL');
    });

    it('computes WATCH status when consumption is between 85% and 100%', () => {
      const res = calculateSectionVariance('1000000', '900000');
      expect(res.consumptionPercentage).toBe('90.00');
      expect(res.isOverBudget).toBe(false);
      expect(res.status).toBe('WATCH');
    });

    it('computes OVERRUN status when consumption exceeds 100%', () => {
      const res = calculateSectionVariance('1000000', '1150000');
      expect(res.consumptionPercentage).toBe('115.00');
      expect(res.isOverBudget).toBe(true);
      expect(res.status).toBe('OVERRUN');
      expect(res.remainingBudget).toBe('-150000.00');
    });
  });
});
