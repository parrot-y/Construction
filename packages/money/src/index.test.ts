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
  getRebarUnitWeight,
  calculateRebarCutLengthMeters,
  calculateBs8666CutLengthExact,
  calculateStockBars12m,
  calculateKraVat16,
  extractKraVat16FromGross,
  calculateKraWithholdingTax,
  calculateJbcDualMoietyRetention,
  REBAR_UNIT_WEIGHTS_KG_PER_M,
  evaluateRmcTransitStatus,
  evaluateRmcSlumpTolerance,
  getStructuralSteelSection,
  calculateStructuralMemberTotals,
  calculateSoilCompaction,
  evaluateAsphaltThermalQuality,
  calculateAsphaltCoreCompaction,
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

  describe('Rebar & Bar Bending Schedule (BBS) Math (Milestone M25)', () => {
    it('returns exact BS 8666 unit weights for Kenyan high-yield rebar', () => {
      expect(getRebarUnitWeight('Y8').toString()).toBe('0.395');
      expect(getRebarUnitWeight('Y10').toString()).toBe('0.617');
      expect(getRebarUnitWeight('Y12').toString()).toBe('0.888');
      expect(getRebarUnitWeight('Y16').toString()).toBe('1.579');
      expect(getRebarUnitWeight('Y20').toString()).toBe('2.466');
      expect(getRebarUnitWeight('Y25').toString()).toBe('3.854');
      expect(getRebarUnitWeight('Y32').toString()).toBe('6.313');
    });

    it('mathematically verifies rebar unit weights against theoretical formula rho * pi * d^2 / 4 with steel density 7850 kg/m3', () => {
      const steelDensityKgPerM3 = 7850;
      const diameters = [
        { bar: 'Y8', dMm: 8, standardWeight: '0.395' },
        { bar: 'Y10', dMm: 10, standardWeight: '0.617' },
        { bar: 'Y12', dMm: 12, standardWeight: '0.888' },
        { bar: 'Y16', dMm: 16, standardWeight: '1.579' }, // BS 8666 Table 1 standard nominal mass
        { bar: 'Y20', dMm: 20, standardWeight: '2.466' },
        { bar: 'Y25', dMm: 25, standardWeight: '3.854' }, // BS 8666 Table 1 standard nominal mass
        { bar: 'Y32', dMm: 32, standardWeight: '6.313' },
      ];

      for (const item of diameters) {
        const dM = item.dMm / 1000;
        const areaM2 = (Math.PI * Math.pow(dM, 2)) / 4;
        const theoreticalWeightKgPerM = steelDensityKgPerM3 * areaM2;
        const tableWeight = parseFloat(REBAR_UNIT_WEIGHTS_KG_PER_M[item.bar] || '0');

        // Difference between standard tabular weight and pure formula is <= 0.001 kg/m (due to standard rounding)
        expect(Math.abs(theoreticalWeightKgPerM - tableWeight)).toBeLessThan(0.0015);
        expect(REBAR_UNIT_WEIGHTS_KG_PER_M[item.bar]).toBe(item.standardWeight);
      }
    });

    it('calculates Shape 00 straight cut length (L = A)', () => {
      const cut = calculateRebarCutLengthMeters('00', 'Y16', 4500);
      expect(cut.toString()).toBe('4.5');

      const exactCut = calculateBs8666CutLengthExact('00', 'Y16', 4500);
      expect(exactCut.toString()).toBe('4.5');
    });

    it('calculates Shape 11 single bend / crank with exact BS 8666 bend deduction (L = A + B - 0.5r - d)', () => {
      // Bar Y16 (d = 16mm), A = 3000mm (3.0m), B = 600mm (0.6m)
      // Standard BS 8666 Table 2 minimum bend radius: r = 2d = 32mm (0.032m)
      // Cut length L = A + B - 0.5r - d = 3.0 + 0.6 - 0.5*(0.032) - 0.016 = 3.600 - 0.016 - 0.016 = 3.568m
      const exactCut = calculateBs8666CutLengthExact('11', 'Y16', 3000, 600);
      expect(exactCut.toString()).toBe('3.568');

      // Via calculateRebarCutLengthMeters with exactDeductions option
      const cutWithOptions = calculateRebarCutLengthMeters('11', 'Y16', 3000, 600, null, null, {
        exactDeductions: true,
      });
      expect(cutWithOptions.toString()).toBe('3.568');
    });

    it('calculates Shape 21 L-bar cut length (nominal A + B and exact L = A + B - r - 2d)', () => {
      // Simplified nominal A + B: 3000 + 450 = 3450mm = 3.45m
      const cut = calculateRebarCutLengthMeters('21', 'Y16', 3000, 450);
      expect(cut.toString()).toBe('3.45');

      // Exact BS 8666 bend deduction: L = A + B - r - 2d
      // Bar Y16 (d = 16mm), r = 2d = 32mm
      // L = 3000 + 450 - 32 - 2*(16) = 3450 - 64 = 3386mm = 3.386m
      const exactCut = calculateBs8666CutLengthExact('21', 'Y16', 3000, 450);
      expect(exactCut.toString()).toBe('3.386');

      // With custom bend radius r = 40mm: L = 3450 - 40 - 32 = 3378mm = 3.378m
      const customRadiusCut = calculateBs8666CutLengthExact('21', 'Y16', 3000, 450, null, null, 40);
      expect(customRadiusCut.toString()).toBe('3.378');
    });

    it('calculates Shape 51 rectangular stirrup link cut length with 24d hook allowance (L = 2(A + B) + 24d)', () => {
      // 2 * (250mm + 400mm) = 1300mm = 1.30m + 24 * 8mm = 192mm = 0.192m => 1.492m
      const cut = calculateRebarCutLengthMeters('51', 'Y8', 250, 400);
      expect(cut.toString()).toBe('1.492');

      const exactCut = calculateBs8666CutLengthExact('51', 'Y8', 250, 400);
      expect(exactCut.toString()).toBe('1.492');

      // Column starter link: A = 200mm, B = 350mm, Y8 (8mm): 2*(200+350) + 24*8 = 1100 + 192 = 1292mm = 1.292m
      const linkCut = calculateBs8666CutLengthExact('51', 'Y8', 200, 350);
      expect(linkCut.toString()).toBe('1.292');
    });

    it('calculates commercial 12m stock bar requirements N_12m = ceil(L_total / 12)', () => {
      expect(calculateStockBars12m(0)).toBe(0);
      expect(calculateStockBars12m(4.5)).toBe(1);   // 4.5m <= 12m -> 1 bar
      expect(calculateStockBars12m(12.0)).toBe(1);  // exactly 12m -> 1 bar
      expect(calculateStockBars12m(12.001)).toBe(2); // 12.001m -> 2 bars
      expect(calculateStockBars12m(134.4)).toBe(12); // 134.4 / 12 = 11.2 -> ceil = 12 bars
      expect(calculateStockBars12m('240.00')).toBe(20); // 240 / 12 = 20 bars
    });
  });

  describe('Safaricom Daraja B2C Kenyan Phone Validation', () => {
    // Regex matching KenyanPhoneSchema: /^(?:\+?254|0)[17]\d{8}$/
    const kenyanPhoneRegex = /^(?:\+?254|0)[17]\d{8}$/;

    it('accepts valid Kenyan mobile phone formats (+254, 254, and 0 prefixes for 07xx and 01xx)', () => {
      expect(kenyanPhoneRegex.test('+254712345678')).toBe(true); // Standard Safaricom 07xx with +
      expect(kenyanPhoneRegex.test('254712345678')).toBe(true);  // Daraja B2C gateway MSISDN
      expect(kenyanPhoneRegex.test('0712345678')).toBe(true);   // Local Kenyan format
      expect(kenyanPhoneRegex.test('+254112345678')).toBe(true); // Safaricom new 01xx prefix with +
      expect(kenyanPhoneRegex.test('254112345678')).toBe(true);  // Daraja B2C 01xx
      expect(kenyanPhoneRegex.test('0112345678')).toBe(true);   // Local 01xx format
      expect(kenyanPhoneRegex.test('+254722000000')).toBe(true); // Safaricom corporate
    });

    it('rejects invalid, malformed, or foreign phone numbers', () => {
      expect(kenyanPhoneRegex.test('+255712345678')).toBe(false); // Tanzania
      expect(kenyanPhoneRegex.test('+256712345678')).toBe(false); // Uganda
      expect(kenyanPhoneRegex.test('0812345678')).toBe(false);    // Invalid national mobile trunk (08xx)
      expect(kenyanPhoneRegex.test('071234567')).toBe(false);     // Too short (9 digits)
      expect(kenyanPhoneRegex.test('07123456789')).toBe(false);    // Too long (11 digits)
      expect(kenyanPhoneRegex.test('invalid_phone')).toBe(false);
      expect(kenyanPhoneRegex.test('')).toBe(false);
    });
  });

  describe('KRA e-TIMS VSCU 16% VAT & Cap 470 Withholding Tax Precision', () => {
    it('computes 16% KRA standard VAT with Decimal precision and ROUND_HALF_UP', () => {
      // Supply of ready-mix concrete: KES 100,000.00 -> 16% VAT = 16,000.00 -> Gross = 116,000.00
      const res = calculateKraVat16('100000.00');
      expect(res.vatAmount.toString()).toBe('16000');
      expect(toCurrencyString(res.vatAmount)).toBe('16000.00');
      expect(toCurrencyString(res.grossAmount)).toBe('116000.00');
      expect(res.taxableAmount.plus(res.vatAmount).equals(res.grossAmount)).toBe(true);
    });

    it('correctly rounds fractional cents in 16% VAT calculations', () => {
      // Line item taxable: KES 14,375.45 * 0.16 = 2300.072 -> rounds to 2300.07
      const res = calculateKraVat16('14375.45');
      expect(res.vatAmount.toString()).toBe('2300.07');
      expect(res.grossAmount.toString()).toBe('16675.52');
      // Verifies e-TIMS VSCU invariant: totalInvoiceAmount = totalTaxableAmount + totalTaxAmount
      expect(res.taxableAmount.plus(res.vatAmount).equals(res.grossAmount)).toBe(true);
    });

    it('extracts KRA 16% VAT from gross VAT-inclusive amounts without penny leakage', () => {
      // Gross KES 116,000.00 inclusive -> Taxable KES 100,000.00, VAT KES 16,000.00
      const res1 = extractKraVat16FromGross('116000.00');
      expect(toCurrencyString(res1.taxableAmount)).toBe('100000.00');
      expect(toCurrencyString(res1.vatAmount)).toBe('16000.00');
      expect(res1.taxableAmount.plus(res1.vatAmount).equals(res1.grossAmount)).toBe(true);

      // Gross KES 100,000.00 inclusive: 100000 / 1.16 = 86206.89655... -> 86206.90, VAT = 13793.10
      const res2 = extractKraVat16FromGross('100000.00');
      expect(toCurrencyString(res2.taxableAmount)).toBe('86206.90');
      expect(toCurrencyString(res2.vatAmount)).toBe('13793.10');
      expect(res2.taxableAmount.plus(res2.vatAmount).equals(res2.grossAmount)).toBe(true);
    });

    it('computes Kenyan statutory Withholding Tax (3% WHT) and Withholding VAT (2% WHVAT) per Cap 470', () => {
      // Subcontractor valuation gross: KES 1,000,000.00
      // WHT 3% = KES 30,000.00
      // WHVAT 2% = KES 20,000.00
      // Net Payable = 1,000,000 - 30,000 - 20,000 = KES 950,000.00
      const cert = calculateKraWithholdingTax('1000000.00', '3.00', '2.00');
      expect(toCurrencyString(cert.whtAmount)).toBe('30000.00');
      expect(toCurrencyString(cert.whvatAmount)).toBe('20000.00');
      expect(toCurrencyString(cert.totalWithheld)).toBe('50000.00');
      expect(toCurrencyString(cert.netPayable)).toBe('950000.00');
      expect(cert.netPayable.plus(cert.totalWithheld).equals(cert.grossAmount)).toBe(true);
    });

    it('handles fractional amounts under KRA WHT & WHVAT without rounding disparity', () => {
      // Gross KES 333,333.33:
      // WHT (3%): 333,333.33 * 0.03 = 9999.9999 -> rounds to 10,000.00
      // WHVAT (2%): 333,333.33 * 0.02 = 6666.6666 -> rounds to 6,666.67
      // Total withheld: 16,666.67
      // Net payable: 333,333.33 - 16,666.67 = 316,666.66
      const cert = calculateKraWithholdingTax('333333.33', '3.00', '2.00');
      expect(toCurrencyString(cert.whtAmount)).toBe('10000.00');
      expect(toCurrencyString(cert.whvatAmount)).toBe('6666.67');
      expect(toCurrencyString(cert.totalWithheld)).toBe('16666.67');
      expect(toCurrencyString(cert.netPayable)).toBe('316666.66');
      expect(cert.netPayable.plus(cert.totalWithheld).equals(cert.grossAmount)).toBe(true);
    });
  });

  describe('JBC 1999 Joint Building Council Dual-Moiety Retention', () => {
    it('implements interim 10% retention deduction capped at 5% of Contract Sum', () => {
      const contractSum = '50000000.00'; // KES 50M contract sum
      // 5% cap = KES 2,500,000.00
      // Interim valuation 1: Gross KES 10,000,000.00 -> 10% = KES 1,000,000.00 (< 2.5M cap)
      const val1 = calculateJbcDualMoietyRetention(contractSum, '10000000.00', 'INTERIM');
      expect(toCurrencyString(val1.retentionFundCap)).toBe('2500000.00');
      expect(toCurrencyString(val1.totalRetentionHeld)).toBe('1000000.00');
      expect(toCurrencyString(val1.remainingRetention)).toBe('1000000.00');

      // Interim valuation 4: Gross KES 40,000,000.00 -> 10% = KES 4,000,000.00 -> Capped at KES 2,500,000.00
      const val4 = calculateJbcDualMoietyRetention(contractSum, '40000000.00', 'INTERIM');
      expect(toCurrencyString(val4.computedInterimRetention)).toBe('4000000.00');
      expect(toCurrencyString(val4.totalRetentionHeld)).toBe('2500000.00'); // Enforces 5% limit
    });

    it('releases First Moiety (50% of retention fund = 2.5% of contract sum) upon Certificate of Practical Completion (CPC)', () => {
      const contractSum = '50000000.00'; // KES 50M
      // At Practical Completion, full 5% retention fund has accumulated = KES 2,500,000.00
      const cpc = calculateJbcDualMoietyRetention(contractSum, '50000000.00', 'PRACTICAL_COMPLETION');
      expect(toCurrencyString(cpc.totalRetentionHeld)).toBe('2500000.00');
      expect(toCurrencyString(cpc.firstMoietyAmount)).toBe('1250000.00'); // 50% of retention fund
      expect(toCurrencyString(cpc.releasedAmountForStage)).toBe('1250000.00');
      expect(toCurrencyString(cpc.remainingRetention)).toBe('1250000.00'); // Second moiety remains held
    });

    it('releases Second Moiety (final 50% = remaining 2.5% of contract sum) upon Final Account / DLP Expiry', () => {
      const contractSum = '50000000.00'; // KES 50M
      const finalRelease = calculateJbcDualMoietyRetention(contractSum, '50000000.00', 'FINAL_ACCOUNT_DLP');
      expect(toCurrencyString(finalRelease.secondMoietyAmount)).toBe('1250000.00');
      expect(toCurrencyString(finalRelease.releasedAmountForStage)).toBe('1250000.00');
      expect(toCurrencyString(finalRelease.remainingRetention)).toBe('0.00'); // Zero remaining retention
      expect(finalRelease.firstMoietyAmount.plus(finalRelease.secondMoietyAmount).equals(finalRelease.totalRetentionHeld)).toBe(true);
    });

    it('supports 10% total retention contracts with 5% CPC release and 5% Final Account release', () => {
      const contractSum = '20000000.00'; // KES 20M contract
      // Project terms: 10% total retention cap = KES 2,000,000.00
      const cpc = calculateJbcDualMoietyRetention(contractSum, '20000000.00', 'PRACTICAL_COMPLETION', '10.00', '10.00');
      expect(toCurrencyString(cpc.retentionFundCap)).toBe('2000000.00'); // 10% of contract sum
      expect(toCurrencyString(cpc.firstMoietyAmount)).toBe('1000000.00'); // 5% of contract sum at CPC
      expect(toCurrencyString(cpc.remainingRetention)).toBe('1000000.00'); // Remaining 5% of contract sum

      const finalRel = calculateJbcDualMoietyRetention(contractSum, '20000000.00', 'FINAL_ACCOUNT_DLP', '10.00', '10.00');
      expect(toCurrencyString(finalRel.secondMoietyAmount)).toBe('1000000.00'); // 5% of contract sum at Final
      expect(toCurrencyString(finalRel.remainingRetention)).toBe('0.00');
    });
  });

  describe('Milestone M27: Ready-Mix Concrete (RMC) Transit & Slump Evaluation', () => {
    it('evaluates optimal transit duration (<= 90 min) under BS EN 206 / KS 02-598', () => {
      const now = new Date();
      const dispatchedAt = new Date(now.getTime() - 45 * 60000); // 45 minutes ago
      const evalResult = evaluateRmcTransitStatus(dispatchedAt, now);

      expect(evalResult.transitMinutes).toBe(45);
      expect(evalResult.status).toBe('OPTIMAL');
      expect(evalResult.isColdJointRisk).toBe(false);
      expect(evalResult.message).toContain('optimal hydration window');
    });

    it('flags warning when transit exceeds 90 minutes but <= 120 minutes', () => {
      const now = new Date();
      const dispatchedAt = new Date(now.getTime() - 105 * 60000); // 105 minutes ago
      const evalResult = evaluateRmcTransitStatus(dispatchedAt, now);

      expect(evalResult.transitMinutes).toBe(105);
      expect(evalResult.status).toBe('WARNING_HYDRATION_ACCELERATING');
      expect(evalResult.statusLabel).toContain('Hydration Accelerating');
      expect(evalResult.isColdJointRisk).toBe(false);
      expect(evalResult.message).toContain('Slump loss expected');
    });

    it('triggers critical cold joint risk hold point when transit exceeds 120 minutes', () => {
      const now = new Date();
      const dispatchedAt = new Date(now.getTime() - 135 * 60000); // 135 minutes ago
      const evalResult = evaluateRmcTransitStatus(dispatchedAt, now);

      expect(evalResult.transitMinutes).toBe(135);
      expect(evalResult.status).toBe('CRITICAL_COLD_JOINT_RISK');
      expect(evalResult.statusLabel).toContain('Cold Joint Risk');
      expect(evalResult.isColdJointRisk).toBe(true);
      expect(evalResult.message).toContain('severe cold joints');
    });

    it('evaluates slump compliance within +/- 25mm tolerance for pumped concrete (BS EN 12350-2)', () => {
      // Target: 100mm, Measured: 115mm (deviation: +15mm <= 25mm) -> ACCEPTED
      const res1 = evaluateRmcSlumpTolerance(100, 115);
      expect(res1.isWithinTolerance).toBe(true);
      expect(res1.deviationMm).toBe(15);
      expect(res1.verdict).toBe('ACCEPTED');

      // Target: 100mm, Measured: 65mm (deviation: -35mm > 25mm) -> REJECTED
      const res2 = evaluateRmcSlumpTolerance(100, 65);
      expect(res2.isWithinTolerance).toBe(false);
      expect(res2.deviationMm).toBe(-35);
      expect(res2.verdict).toBe('REJECTED');
    });
  });

  describe('Milestone M28: Structural Steel Framing & Fabrication Takeoff', () => {
    it('provides standard BS 4 / BS EN 10056 section properties (UB, UC, RHS, SHS, CHS, Angle)', () => {
      const ub = getStructuralSteelSection('UB 406x178x74');
      expect(ub.unitWeightKgPerM).toBe('74.200');
      expect(ub.paintAreaM2PerM).toBe('1.510');

      const uc = getStructuralSteelSection('UC 203x203x46');
      expect(uc.unitWeightKgPerM).toBe('46.100');
      expect(uc.paintAreaM2PerM).toBe('1.200');

      const rhs = getStructuralSteelSection('RHS 100x50x4.0');
      expect(rhs.unitWeightKgPerM).toBe('8.770');
      expect(rhs.paintAreaM2PerM).toBe('0.290');
    });

    it('calculates member linear length, total weight in kg, tonnage, and paint area accurately', () => {
      // 8 Rafters of UB 406x178x74, length 12.500m each
      // Total linear meters: 8 * 12.500 = 100.000m
      // Total weight: 100.000m * 74.200 kg/m = 7,420.00 kg = 7.420 Tonnes
      // Total paint area: 100.000m * 1.510 m2/m = 151.00 m2
      const ub = getStructuralSteelSection('UB 406x178x74');
      const totals = calculateStructuralMemberTotals('12.500', 8, ub.unitWeightKgPerM, ub.paintAreaM2PerM);

      expect(totals.totalLengthMeters.toString()).toBe('100');
      expect(totals.totalWeightKg.toString()).toBe('7420');
      expect(totals.totalTonnage.toString()).toBe('7.42');
      expect(totals.totalPaintAreaM2.toString()).toBe('151');
    });
  });

  describe('Milestone M29: Geotechnical Soil Compaction QA Engine', () => {
    it('calculates relative compaction and validates PASS on acceptable moisture', () => {
      // Lab MDD = 2.150 g/cm3, OMC = 9.50%
      // Field wet density = 2.260 g/cm3, Field moisture = 10.00%
      // Dry density = 2.260 / (1 + 0.10) = 2.0545 g/cm3 -> 2.055 g/cm3
      // RC = (2.055 / 2.150) * 100 = 95.58%
      const res = calculateSoilCompaction('2.150', '9.50', '2.260', '10.00', '95.00', 18);

      expect(res.isPass).toBe(true);
      expect(res.verdict).toBe('PASS');
      expect(res.fieldDryDensityGCm3.toString()).toBe('2.055');
      expect(res.relativeCompactionPercent.toString()).toBe('95.58');
      expect(res.moistureDeviationPercent.toString()).toBe('0.5');
      expect(res.estimatedCbrPercent).not.toBeNull();
      // Penetration rate = 100 / 18 = 5.556 mm/blow -> CBR approx 46%
      expect(res.estimatedCbrPercent?.toNumber()).toBeGreaterThan(40);
    });

    it('flags FAIL_LOW_COMPACTION when relative compaction is below required threshold', () => {
      // Lab MDD = 2.200 g/cm3, Field wet = 2.100, moisture = 8.00%
      // Dry density = 2.100 / 1.08 = 1.944 g/cm3
      // RC = (1.944 / 2.200) * 100 = 88.36% (< 95%)
      const res = calculateSoilCompaction('2.200', '8.50', '2.100', '8.00', '95.00');

      expect(res.isPass).toBe(false);
      expect(res.verdict).toBe('FAIL_LOW_COMPACTION');
      expect(res.message).toContain('Additional roller passes required');
    });

    it('flags FAIL_MOISTURE_EXCESS when field moisture is > 2.5% above OMC', () => {
      // Lab OMC = 10.0%, Field moisture = 13.5% (+3.5% excess)
      // Even if RC >= 95%, spongy subgrade is rejected
      const res = calculateSoilCompaction('2.000', '10.00', '2.200', '13.50', '95.00');

      expect(res.isPass).toBe(false);
      expect(res.verdict).toBe('FAIL_MOISTURE_EXCESS');
      expect(res.message).toContain('heaving/spongy subgrade');
    });
  });

  describe('Milestone M30: Asphalt Pavement Quality & Thermal Tracker', () => {
    it('evaluates COMPLIANT thermal quality within BS 594987 temperature envelope', () => {
      const evalResult = evaluateAsphaltThermalQuality('165.0', '148.0', '132.0', '92.0');
      expect(evalResult.thermalVerdict).toBe('COMPLIANT');
      expect(evalResult.isPavingApproved).toBe(true);
    });

    it('triggers REJECTED_COLD_PAVING when delivery or finish temperature is critically low', () => {
      // Delivery temp 130°C < 135°C threshold
      const evalResult = evaluateAsphaltThermalQuality('155.0', '130.0', '110.0', '75.0');
      expect(evalResult.thermalVerdict).toBe('REJECTED_COLD_PAVING');
      expect(evalResult.isPavingApproved).toBe(false);
      expect(evalResult.message).toContain('CRITICAL THERMAL DEFICIT');
    });

    it('calculates asphalt core compaction and accepts compliant core samples', () => {
      // Design thickness = 50.0mm, Core = 52.0mm
      // Marshall density = 2.400 g/cm3, Core density = 2.340 g/cm3
      // Compaction = (2.340 / 2.400) * 100 = 97.50% (>= 97%)
      const coreRes = calculateAsphaltCoreCompaction('52.00', '50.00', '2.340', '2.400');

      expect(coreRes.isAccepted).toBe(true);
      expect(coreRes.qaVerdict).toBe('ACCEPTED');
      expect(coreRes.compactionPercent.toString()).toBe('97.5');
      expect(coreRes.thicknessDeviationMm.toString()).toBe('2');
    });

    it('flags CONDITIONAL_PENALTY when compaction is compliant but minor thickness deficit exists', () => {
      // Design thickness = 50.0mm, Core = 48.0mm (-2.0mm deficit within -3.0mm allowable penalty band)
      // Compaction = 98.0%
      const coreRes = calculateAsphaltCoreCompaction('48.00', '50.00', '2.352', '2.400');

      expect(coreRes.isAccepted).toBe(true);
      expect(coreRes.qaVerdict).toBe('CONDITIONAL_PENALTY');
      expect(coreRes.message).toContain('contract payment reduction');
    });
  });
});
