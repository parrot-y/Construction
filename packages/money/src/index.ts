import { Decimal } from 'decimal.js';

// Configure decimal.js defaults for strict financial precision
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21,
});

export { Decimal };

export type DecimalValue = string | number | Decimal;

/**
 * Safely converts an input into an immutable Decimal instance.
 * Throws an explicit error if input is an invalid numeric format or NaN.
 */
export function toDecimal(value: DecimalValue): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  try {
    const d = new Decimal(value);
    if (d.isNaN()) {
      throw new Error(`Invalid numeric value: ${value}`);
    }
    return d;
  } catch (err) {
    throw new Error(`Failed to parse Decimal from value "${value}": ${(err as Error).message}`);
  }
}

/**
 * Computes amount = quantity * unit_rate without precision loss.
 */
export function multiplyQuantityByRate(quantity: DecimalValue, unitRate: DecimalValue): Decimal {
  const q = toDecimal(quantity);
  const r = toDecimal(unitRate);
  return q.times(r);
}

/**
 * Computes line total rounded to 2 decimal places (KES cents) using ROUND_HALF_UP.
 */
export function calculateLineTotal(quantity: DecimalValue, unitRate: DecimalValue): Decimal {
  const product = multiplyQuantityByRate(quantity, unitRate);
  return product.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Formats a decimal currency amount to standard KES format: 2 decimal places.
 * Example: 1250000.5 -> "1250000.50"
 */
export function toCurrencyString(amount: DecimalValue): string {
  const d = toDecimal(amount);
  return d.toFixed(2, Decimal.ROUND_HALF_UP);
}

/**
 * Computes cost consumption ratio = actual approved cost / current approved budget.
 * Returns 0 if current approved budget is zero.
 */
export function calculateBudgetConsumptionRatio(
  actualCost: DecimalValue,
  currentApprovedBudget: DecimalValue,
): Decimal {
  const actual = toDecimal(actualCost);
  const budget = toDecimal(currentApprovedBudget);

  if (budget.isZero() || budget.isNegative()) {
    return new Decimal(0);
  }

  return actual.dividedBy(budget);
}

/**
 * Evaluates whether cost consumption is materially ahead of physical progress.
 * Invariant: If cost consumption % is materially ahead of recorded physical progress % (threshold >= 15%),
 * returns a neutral, factual warning. Never uses words like "fraud", "theft", or "overbilled".
 */
export function evaluateProgressVariance(
  costConsumptionRatio: DecimalValue,
  physicalProgressRatio: DecimalValue,
  thresholdDifference = 0.15,
): { hasWarning: boolean; message: string | null } {
  const costRatio = toDecimal(costConsumptionRatio);
  const progressRatio = toDecimal(physicalProgressRatio);

  const diff = costRatio.minus(progressRatio);

  if (diff.greaterThanOrEqualTo(thresholdDifference)) {
    return {
      hasWarning: true,
      message: 'Cost consumption is significantly ahead of recorded physical progress. Review project costs and progress records.',
    };
  }

  return {
    hasWarning: false,
    message: null,
  };
}

export type VarianceSeverity = 'info' | 'warning' | 'critical';
export type VarianceStatus = 'ON_TRACK' | 'ATTENTION' | 'ACTION_REQUIRED';

export interface DetailedVarianceResult {
  costConsumptionRatio: Decimal;
  physicalProgressRatio: Decimal;
  costConsumptionPercentage: string;
  physicalProgressPercentage: string;
  differenceRatio: Decimal;
  differencePercentage: string;
  hasWarning: boolean;
  status: VarianceStatus;
  statusLabel: string;
  severity: VarianceSeverity;
  message: string;
}

export interface SectionVarianceResult {
  allocatedBudget: string;
  actualSpent: string;
  pendingSpent: string;
  remainingBudget: string;
  consumptionPercentage: string;
  isOverBudget: boolean;
  status: 'NORMAL' | 'WATCH' | 'OVERRUN';
}

/**
 * Computes high-fidelity project variance analytics comparing cost consumption against physical progress.
 * Enforces strict neutral language (ADR-001, ADR-005, System Design 6.3) with zero inflammatory words.
 */
export function calculateDetailedVariance(
  costConsumptionRatio: DecimalValue,
  physicalProgressRatio: DecimalValue,
): DetailedVarianceResult {
  const costRatio = toDecimal(costConsumptionRatio);
  const progressRatio = toDecimal(physicalProgressRatio);
  const diff = costRatio.minus(progressRatio);

  const costPct = costRatio.times(100).toFixed(2);
  const progPct = progressRatio.times(100).toFixed(2);
  const diffPctNum = diff.times(100);
  const diffPct = `${diffPctNum.greaterThanOrEqualTo(0) ? '+' : ''}${diffPctNum.toFixed(2)}%`;

  if (diff.greaterThanOrEqualTo(0.15)) {
    return {
      costConsumptionRatio: costRatio,
      physicalProgressRatio: progressRatio,
      costConsumptionPercentage: costPct,
      physicalProgressPercentage: progPct,
      differenceRatio: diff,
      differencePercentage: diffPct,
      hasWarning: true,
      status: 'ACTION_REQUIRED',
      statusLabel: 'Significant Disparity',
      severity: 'critical',
      message: 'Cost consumption is significantly ahead of recorded physical progress. Review project costs and progress records.',
    };
  }

  if (diff.greaterThan(0)) {
    return {
      costConsumptionRatio: costRatio,
      physicalProgressRatio: progressRatio,
      costConsumptionPercentage: costPct,
      physicalProgressPercentage: progPct,
      differenceRatio: diff,
      differencePercentage: diffPct,
      hasWarning: false,
      status: 'ATTENTION',
      statusLabel: 'Moderate Disparity',
      severity: 'warning',
      message: 'Cost consumption is moderately ahead of recorded physical progress. Monitor upcoming milestone valuations.',
    };
  }

  return {
    costConsumptionRatio: costRatio,
    physicalProgressRatio: progressRatio,
    costConsumptionPercentage: costPct,
    physicalProgressPercentage: progPct,
    differenceRatio: diff,
    differencePercentage: diffPct,
    hasWarning: false,
    status: 'ON_TRACK',
    statusLabel: 'Normal Alignment',
    severity: 'info',
    message: 'Expenditure is aligned with recorded physical progress.',
  };
}

/**
 * Evaluates budget variance for an individual BOQ section.
 */
export function calculateSectionVariance(
  allocatedBudget: DecimalValue,
  actualSpent: DecimalValue,
  pendingSpent: DecimalValue = 0,
): SectionVarianceResult {
  const budget = toDecimal(allocatedBudget);
  const spent = toDecimal(actualSpent);
  const pending = toDecimal(pendingSpent);

  const remaining = budget.minus(spent);
  const consumptionRatio = budget.isZero() ? new Decimal(0) : spent.dividedBy(budget);
  const consumptionPercentage = consumptionRatio.times(100).toFixed(2);
  const isOverBudget = spent.greaterThan(budget);

  let status: 'NORMAL' | 'WATCH' | 'OVERRUN' = 'NORMAL';
  if (isOverBudget) {
    status = 'OVERRUN';
  } else if (consumptionRatio.greaterThanOrEqualTo(0.85)) {
    status = 'WATCH';
  }

  return {
    allocatedBudget: toCurrencyString(budget),
    actualSpent: toCurrencyString(spent),
    pendingSpent: toCurrencyString(pending),
    remainingBudget: toCurrencyString(remaining),
    consumptionPercentage,
    isOverBudget,
    status,
  };
}

/**
 * Standard unit weight per meter (kg/m) for reinforcing steel bars under BS 8666 / KS 02-598:
 * Formula: d^2 / 162.28 kg/m
 */
export const REBAR_UNIT_WEIGHTS_KG_PER_M: Record<string, string> = {
  Y8: '0.395',
  Y10: '0.617',
  Y12: '0.888',
  Y16: '1.579',
  Y20: '2.466',
  Y25: '3.854',
  Y32: '6.313',
};

export function getRebarUnitWeight(barType: string): Decimal {
  const weight = REBAR_UNIT_WEIGHTS_KG_PER_M[barType.toUpperCase()];
  if (!weight) {
    throw new Error(`Unsupported bar type: ${barType}`);
  }
  return new Decimal(weight);
}

export interface RebarCutLengthOptions {
  radiusMm?: number;
  exactDeductions?: boolean;
}

/**
 * Calculates cutting length in meters based on BS 8666 standard shape codes:
 * - 00: Straight bar (A)
 * - 11: Single bend (A + B)
 * - 21: L-Bar 90 deg bend (A + B)
 * - 51: Rectangular Link/Stirrup (2 * (A + B) + hook allowance: 24 * d / 1000)
 * - 61: Circular/Helical Link (pi * A + 24 * d / 1000)
 *
 * When options.exactDeductions is true, computes exact BS 8666 Table 2 formulas with bend deductions:
 * - Shape 11: L = A + B - 0.5r - d
 * - Shape 21: L = A + B - r - 2d
 */
export function calculateRebarCutLengthMeters(
  shapeCode: string,
  barType: string,
  dimA: number,
  dimB?: number | null,
  dimC?: number | null,
  dimD?: number | null,
  options?: RebarCutLengthOptions,
): Decimal {
  if (options?.exactDeductions) {
    return calculateBs8666CutLengthExact(shapeCode, barType, dimA, dimB, dimC, dimD, options.radiusMm);
  }

  const dMm = parseInt(barType.replace(/\D/g, ''), 10) || 12;
  const aM = new Decimal(dimA).dividedBy(1000);
  const bM = new Decimal(dimB || 0).dividedBy(1000);
  const hookM = new Decimal(24).times(dMm).dividedBy(1000);

  switch (shapeCode) {
    case '00':
      return aM.toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    case '11':
    case '21':
      return aM.plus(bM).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    case '51':
      return aM.plus(bM).times(2).plus(hookM).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    case '61':
      return aM.times(Math.PI).plus(hookM).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    default:
      return aM.plus(bM).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  }
}

/**
 * Exact BS 8666:2005 / KS 02-598 cutting length formula implementations including bend deductions:
 * - Shape 00: Straight bar: L = A
 * - Shape 11: Single bend / crank: L = A + B - 0.5r - d
 * - Shape 21: 90 deg bend / L-bar: L = A + B - r - 2d
 * - Shape 51: Rectangular Link / Stirrup: L = 2(A + B) + 24d
 * - Shape 61: Circular Link: L = pi * A + 24d
 * 
 * Standard minimum internal bend radius (r):
 * - For bar diameter d <= 16mm: r = 2d (mandrel 4d)
 * - For bar diameter d >= 20mm: r = 3.5d (mandrel 7d)
 */
export function calculateBs8666CutLengthExact(
  shapeCode: string,
  barType: string,
  dimA: number,
  dimB?: number | null,
  _dimC?: number | null,
  _dimD?: number | null,
  radiusMm?: number | null,
): Decimal {
  const dMm = parseInt(barType.replace(/\D/g, ''), 10) || 12;
  // Default to standard minimum bend radius per BS 8666 Table 2 if not explicitly specified
  const rMm = radiusMm ?? (dMm <= 16 ? 2 * dMm : 3.5 * dMm);

  const aM = new Decimal(dimA).dividedBy(1000);
  const bM = new Decimal(dimB || 0).dividedBy(1000);
  const dM = new Decimal(dMm).dividedBy(1000);
  const rM = new Decimal(rMm).dividedBy(1000);
  const hookM = new Decimal(24).times(dMm).dividedBy(1000);

  switch (shapeCode) {
    case '00':
      return aM.toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    case '11':
      // L = A + B - 0.5r - d
      return aM.plus(bM).minus(rM.times(0.5)).minus(dM).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    case '21':
      // L = A + B - r - 2d
      return aM.plus(bM).minus(rM).minus(dM.times(2)).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    case '51':
      // L = 2(A + B) + 24d
      return aM.plus(bM).times(2).plus(hookM).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    case '61':
      // L = pi * A + 24d
      return aM.times(Math.PI).plus(hookM).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    default:
      return aM.plus(bM).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  }
}

/**
 * Calculates number of standard 12.0m commercial stock bars required for total cut length:
 * Formula: N_12m = ceil(L_total / 12)
 */
export function calculateStockBars12m(totalLengthMeters: DecimalValue): number {
  const total = toDecimal(totalLengthMeters);
  if (total.isZero() || total.isNegative()) {
    return 0;
  }
  const bars = total.dividedBy(12).ceil();
  return Math.max(1, bars.toNumber());
}

export interface KraVatResult {
  taxableAmount: Decimal;
  vatAmount: Decimal;
  grossAmount: Decimal;
  vatRatePct: string;
}

/**
 * Computes KRA e-TIMS standard 16% VAT on taxable supply amount:
 * VAT = ROUND(Taxable * 0.16, 2)
 * Gross = Taxable + VAT
 */
export function calculateKraVat16(taxableAmount: DecimalValue): KraVatResult {
  const taxable = toDecimal(taxableAmount);
  const vat = taxable.times(new Decimal('0.16')).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const gross = taxable.plus(vat);
  return {
    taxableAmount: taxable,
    vatAmount: vat,
    grossAmount: gross,
    vatRatePct: '16.00',
  };
}

/**
 * Extracts KRA e-TIMS 16% VAT from gross VAT-inclusive amount:
 * Taxable = ROUND(Gross / 1.16, 2)
 * VAT = Gross - Taxable
 */
export function extractKraVat16FromGross(grossAmount: DecimalValue): KraVatResult {
  const gross = toDecimal(grossAmount);
  const taxable = gross.dividedBy(new Decimal('1.16')).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vat = gross.minus(taxable);
  return {
    taxableAmount: taxable,
    vatAmount: vat,
    grossAmount: gross,
    vatRatePct: '16.00',
  };
}

export interface KraWithholdingTaxResult {
  grossAmount: Decimal;
  whtRatePct: string;
  whtAmount: Decimal;
  whvatRatePct: string;
  whvatAmount: Decimal;
  totalWithheld: Decimal;
  netPayable: Decimal;
}

/**
 * Computes Kenyan statutory withholding tax under Income Tax Act Cap 470 (3% contractual fee for construction)
 * and Value Added Tax Act Sec 42A (2% WHVAT).
 * Formulations:
 * WHT = ROUND(Gross * (whtRate / 100), 2)
 * WHVAT = ROUND(Gross * (whvatRate / 100), 2)
 * Net Payable = Gross - WHT - WHVAT
 */
export function calculateKraWithholdingTax(
  grossAmount: DecimalValue,
  whtRatePct: DecimalValue = '3.00',
  whvatRatePct: DecimalValue = '2.00',
): KraWithholdingTaxResult {
  const gross = toDecimal(grossAmount);
  const whtRate = toDecimal(whtRatePct);
  const whvatRate = toDecimal(whvatRatePct);

  const wht = gross.times(whtRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const whvat = gross.times(whvatRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalWithheld = wht.plus(whvat);
  const netPayable = gross.minus(totalWithheld);

  return {
    grossAmount: gross,
    whtRatePct: whtRate.toFixed(2),
    whtAmount: wht,
    whvatRatePct: whvatRate.toFixed(2),
    whvatAmount: whvat,
    totalWithheld,
    netPayable,
  };
}

export type JbcRetentionStage = 'INTERIM' | 'PRACTICAL_COMPLETION' | 'FINAL_ACCOUNT_DLP';

export interface JbcRetentionResult {
  contractSum: Decimal;
  retentionFundCap: Decimal;
  retentionCapPct: string;
  interimRetentionRatePct: string;
  computedInterimRetention: Decimal;
  totalRetentionHeld: Decimal;
  firstMoietyAmount: Decimal;
  secondMoietyAmount: Decimal;
  releasedAmountForStage: Decimal;
  remainingRetention: Decimal;
}

/**
 * Implements Joint Building Council (JBC 1999) dual-moiety retention mechanics:
 * - Interim retention deduction: standard 10% on certified gross valuation.
 * - Total retention fund cap: standard 5% (or project contract specified cap) of contract sum.
 * - First Moiety (50% of retention fund = 2.5% of contract sum) released at Practical Completion (CPC).
 * - Second Moiety (remaining 50% = 2.5% of contract sum) released at Final Account / DLP Expiry.
 * Alternatively in projects where 10% total retention is retained: 5% released at CPC and 5% at Final Account.
 */
export function calculateJbcDualMoietyRetention(
  contractSum: DecimalValue,
  grossValuation: DecimalValue,
  stage: JbcRetentionStage = 'INTERIM',
  retentionDeductionPct: DecimalValue = '10.00',
  retentionCapPct: DecimalValue = '5.00',
): JbcRetentionResult {
  const cSum = toDecimal(contractSum);
  const gross = toDecimal(grossValuation);
  const deductionPct = toDecimal(retentionDeductionPct);
  const capPct = toDecimal(retentionCapPct);

  const retentionFundCap = cSum.times(capPct).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const rawInterimRetention = gross.times(deductionPct).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalRetentionHeld = Decimal.min(rawInterimRetention, retentionFundCap);

  // Dual moiety: 50% released at CPC, final 50% at Making Good Defects / Final Account
  const firstMoiety = totalRetentionHeld.times('0.5').toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const secondMoiety = totalRetentionHeld.minus(firstMoiety);

  let releasedAmount = toDecimal('0.00');
  let remainingRetention = totalRetentionHeld;

  if (stage === 'PRACTICAL_COMPLETION') {
    releasedAmount = firstMoiety;
    remainingRetention = secondMoiety;
  } else if (stage === 'FINAL_ACCOUNT_DLP') {
    releasedAmount = secondMoiety;
    remainingRetention = toDecimal('0.00');
  }

  return {
    contractSum: cSum,
    retentionFundCap,
    retentionCapPct: capPct.toFixed(2),
    interimRetentionRatePct: deductionPct.toFixed(2),
    computedInterimRetention: rawInterimRetention,
    totalRetentionHeld,
    firstMoietyAmount: firstMoiety,
    secondMoietyAmount: secondMoiety,
    releasedAmountForStage: releasedAmount,
    remainingRetention,
  };
}

// =============================================================
// READY-MIX CONCRETE (RMC) TRANSIT & SLUMP EVALUATION (MILESTONE M27)
// =============================================================

export interface RmcTransitEvaluation {
  transitMinutes: number;
  status: 'OPTIMAL' | 'WARNING_HYDRATION_ACCELERATING' | 'CRITICAL_COLD_JOINT_RISK';
  statusLabel: string;
  isColdJointRisk: boolean;
  message: string;
}

/**
 * Evaluates transit time of ready-mix concrete from batch plant dispatch to site discharge.
 * Under BS EN 206 / KS 02-598:
 * - <= 90 minutes: OPTIMAL (Safe hydration window)
 * - 91 to 120 minutes: WARNING (Hydration accelerating, pour immediately)
 * - > 120 minutes: CRITICAL_COLD_JOINT_RISK (High risk of uncompactable concrete & cold joint defect)
 */
export function evaluateRmcTransitStatus(
  dispatchedAt: Date | string,
  arrivedOrCurrentTime: Date | string = new Date(),
): RmcTransitEvaluation {
  const dispatchMs = new Date(dispatchedAt).getTime();
  const arrivalMs = new Date(arrivedOrCurrentTime).getTime();
  const diffMinutes = Math.max(0, Math.round((arrivalMs - dispatchMs) / 60000));

  if (diffMinutes > 120) {
    return {
      transitMinutes: diffMinutes,
      status: 'CRITICAL_COLD_JOINT_RISK',
      statusLabel: 'Critical: Cold Joint Risk',
      isColdJointRisk: true,
      message: `Transit duration (${diffMinutes} min) exceeds 120 min max limit. Risk of setting in drum and severe cold joints.`,
    };
  } else if (diffMinutes > 90) {
    return {
      transitMinutes: diffMinutes,
      status: 'WARNING_HYDRATION_ACCELERATING',
      statusLabel: 'Warning: Hydration Accelerating',
      isColdJointRisk: false,
      message: `Transit duration (${diffMinutes} min) exceeds 90 min. Slump loss expected. Discharge must commence immediately.`,
    };
  }

  return {
    transitMinutes: diffMinutes,
    status: 'OPTIMAL',
    statusLabel: 'Optimal Workability',
    isColdJointRisk: false,
    message: `Transit duration (${diffMinutes} min) is within optimal hydration window (<= 90 min).`,
  };
}

export interface RmcSlumpToleranceResult {
  specifiedSlumpMm: number;
  measuredSlumpMm: number;
  deviationMm: number;
  allowedToleranceMm: number;
  isWithinTolerance: boolean;
  verdict: 'ACCEPTED' | 'REJECTED';
}

/**
 * Evaluates concrete slump test compliance against BS EN 12350-2:
 * - Target 50 - 90mm: +/- 20mm
 * - Target 100 - 150mm: +/- 25mm (Standard Kenyan pumped mix)
 * - Target > 150mm: +/- 30mm
 */
export function evaluateRmcSlumpTolerance(
  specifiedSlumpMm: number,
  measuredSlumpMm: number,
): RmcSlumpToleranceResult {
  let allowedToleranceMm = 25;
  if (specifiedSlumpMm < 100) {
    allowedToleranceMm = 20;
  } else if (specifiedSlumpMm > 150) {
    allowedToleranceMm = 30;
  }

  const deviationMm = measuredSlumpMm - specifiedSlumpMm;
  const isWithinTolerance = Math.abs(deviationMm) <= allowedToleranceMm;

  return {
    specifiedSlumpMm,
    measuredSlumpMm,
    deviationMm,
    allowedToleranceMm,
    isWithinTolerance,
    verdict: isWithinTolerance ? 'ACCEPTED' : 'REJECTED',
  };
}

// =============================================================
// STRUCTURAL STEEL FRAMING & FABRICATION TAKEOFF (MILESTONE M28)
// =============================================================

export interface StructuralSteelSectionDef {
  designation: string;
  type: 'UB' | 'UC' | 'RHS' | 'SHS' | 'CHS' | 'ANGLE';
  unitWeightKgPerM: string;
  paintAreaM2PerM: string;
}

/**
 * Standard British / Kenya Standard (BS 4 / BS EN 10056 / KS 02-104) structural steel sections
 */
export const STRUCTURAL_STEEL_SECTIONS: Record<string, StructuralSteelSectionDef> = {
  'UB 406x178x74': { designation: 'UB 406x178x74', type: 'UB', unitWeightKgPerM: '74.200', paintAreaM2PerM: '1.510' },
  'UB 406x178x67': { designation: 'UB 406x178x67', type: 'UB', unitWeightKgPerM: '67.100', paintAreaM2PerM: '1.500' },
  'UB 305x165x40': { designation: 'UB 305x165x40', type: 'UB', unitWeightKgPerM: '40.300', paintAreaM2PerM: '1.230' },
  'UC 203x203x46': { designation: 'UC 203x203x46', type: 'UC', unitWeightKgPerM: '46.100', paintAreaM2PerM: '1.200' },
  'UC 254x254x73': { designation: 'UC 254x254x73', type: 'UC', unitWeightKgPerM: '73.100', paintAreaM2PerM: '1.500' },
  'RHS 100x50x4.0': { designation: 'RHS 100x50x4.0', type: 'RHS', unitWeightKgPerM: '8.770', paintAreaM2PerM: '0.290' },
  'RHS 150x100x5.0': { designation: 'RHS 150x100x5.0', type: 'RHS', unitWeightKgPerM: '18.700', paintAreaM2PerM: '0.490' },
  'SHS 80x80x5.0': { designation: 'SHS 80x80x5.0', type: 'SHS', unitWeightKgPerM: '11.700', paintAreaM2PerM: '0.310' },
  'SHS 100x100x6.0': { designation: 'SHS 100x100x6.0', type: 'SHS', unitWeightKgPerM: '17.500', paintAreaM2PerM: '0.390' },
  'CHS 114.3x4.5': { designation: 'CHS 114.3x4.5', type: 'CHS', unitWeightKgPerM: '12.200', paintAreaM2PerM: '0.360' },
  'ANGLE 100x100x8': { designation: 'ANGLE 100x100x8', type: 'ANGLE', unitWeightKgPerM: '12.200', paintAreaM2PerM: '0.390' },
};

export function getStructuralSteelSection(designation: string): StructuralSteelSectionDef {
  const norm = designation.trim().toUpperCase();
  const match = Object.entries(STRUCTURAL_STEEL_SECTIONS).find(([k]) => k.toUpperCase() === norm);
  if (!match) {
    // Default fallback calculation: estimate unit weight ~ 25 kg/m
    return {
      designation,
      type: designation.startsWith('UB') ? 'UB' : designation.startsWith('UC') ? 'UC' : 'RHS',
      unitWeightKgPerM: '25.000',
      paintAreaM2PerM: '1.000',
    };
  }
  return match[1];
}

export interface StructuralMemberTotals {
  totalLengthMeters: Decimal;
  totalWeightKg: Decimal;
  totalTonnage: Decimal;
  totalPaintAreaM2: Decimal;
}

export function calculateStructuralMemberTotals(
  lengthMeters: DecimalValue,
  quantity: number,
  unitWeightKgPerM: DecimalValue,
  paintAreaM2PerM: DecimalValue,
): StructuralMemberTotals {
  const len = toDecimal(lengthMeters);
  const qty = new Decimal(quantity);
  const weightPerM = toDecimal(unitWeightKgPerM);
  const paintPerM = toDecimal(paintAreaM2PerM);

  const totalLengthMeters = len.times(qty).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  const totalWeightKg = totalLengthMeters.times(weightPerM).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalTonnage = totalWeightKg.dividedBy(1000).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  const totalPaintAreaM2 = totalLengthMeters.times(paintPerM).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    totalLengthMeters,
    totalWeightKg,
    totalTonnage,
    totalPaintAreaM2,
  };
}

// =============================================================
// GEOTECHNICAL SOIL COMPACTION QA ENGINE (MILESTONE M29)
// =============================================================

export interface SoilCompactionEvaluation {
  fieldDryDensityGCm3: Decimal;
  relativeCompactionPercent: Decimal;
  moistureDeviationPercent: Decimal;
  estimatedCbrPercent: Decimal | null;
  verdict: 'PASS' | 'FAIL_LOW_COMPACTION' | 'FAIL_MOISTURE_EXCESS' | 'FAIL_MOISTURE_DEFICIT';
  isPass: boolean;
  message: string;
}

export function calculateSoilCompaction(
  laboratoryMddGCm3: DecimalValue,
  laboratoryOmcPercent: DecimalValue,
  fieldWetDensityGCm3: DecimalValue,
  fieldMoisturePercent: DecimalValue,
  requiredCompactionPercent: DecimalValue = 95.0,
  dcpBlowsPer100mm?: number | null,
): SoilCompactionEvaluation {
  const labMdd = toDecimal(laboratoryMddGCm3);
  const labOmc = toDecimal(laboratoryOmcPercent);
  const wetDensity = toDecimal(fieldWetDensityGCm3);
  const fieldMoisture = toDecimal(fieldMoisturePercent);
  const reqCompaction = toDecimal(requiredCompactionPercent);

  // Field dry density rho_d = rho_wet / (1 + w/100)
  const moistureFactor = toDecimal(1).plus(fieldMoisture.dividedBy(100));
  const fieldDryDensityGCm3 = wetDensity.dividedBy(moistureFactor).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

  // Relative Compaction RC % = (rho_d / rho_max) * 100
  const relativeCompactionPercent = fieldDryDensityGCm3
    .dividedBy(labMdd)
    .times(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // Delta moisture w_field - w_omc
  const moistureDeviationPercent = fieldMoisture.minus(labOmc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // Estimated CBR % from DCP: CBR = 410 / (100 / blows)^1.27
  let estimatedCbrPercent: Decimal | null = null;
  if (dcpBlowsPer100mm && dcpBlowsPer100mm > 0) {
    const penetrationRateMmPerBlow = 100 / dcpBlowsPer100mm;
    const cbrValue = 410 / Math.pow(penetrationRateMmPerBlow, 1.27);
    estimatedCbrPercent = new Decimal(Math.min(100, Math.max(1, cbrValue))).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  let verdict: SoilCompactionEvaluation['verdict'] = 'PASS';
  let message = 'Compaction meets specification requirements (BS 1377 / KS 02-102).';

  if (relativeCompactionPercent.lessThan(reqCompaction)) {
    verdict = 'FAIL_LOW_COMPACTION';
    message = `Insufficient relative compaction: achieved ${relativeCompactionPercent.toFixed(2)}% vs required ${reqCompaction.toFixed(2)}%. Additional roller passes required.`;
  } else if (moistureDeviationPercent.greaterThan(2.5)) {
    verdict = 'FAIL_MOISTURE_EXCESS';
    message = `Excess moisture (+${moistureDeviationPercent.toFixed(2)}% above OMC): risk of heaving/spongy subgrade. Aeration required before recompaction.`;
  } else if (moistureDeviationPercent.lessThan(-3.0)) {
    verdict = 'FAIL_MOISTURE_DEFICIT';
    message = `Moisture deficit (${moistureDeviationPercent.toFixed(2)}% below OMC): brittle compaction. Water spraying required.`;
  }

  return {
    fieldDryDensityGCm3,
    relativeCompactionPercent,
    moistureDeviationPercent,
    estimatedCbrPercent,
    verdict,
    isPass: verdict === 'PASS',
    message,
  };
}

// =============================================================
// ASPHALT PAVEMENT QUALITY & THERMAL TRACKER (MILESTONE M30)
// =============================================================

export interface AsphaltThermalEvaluation {
  thermalVerdict: 'COMPLIANT' | 'COLD_MIX_WARNING' | 'REJECTED_COLD_PAVING';
  isPavingApproved: boolean;
  message: string;
}

export function evaluateAsphaltThermalQuality(
  plantTempC: DecimalValue,
  deliveryTempC: DecimalValue,
  breakdownTempC: DecimalValue,
  finishTempC: DecimalValue,
): AsphaltThermalEvaluation {
  const plant = toDecimal(plantTempC);
  const delivery = toDecimal(deliveryTempC);
  const breakdown = toDecimal(breakdownTempC);
  const finish = toDecimal(finishTempC);

  if (delivery.lessThan(135.0) || finish.lessThan(80.0) || plant.greaterThan(190.0)) {
    return {
      thermalVerdict: 'REJECTED_COLD_PAVING',
      isPavingApproved: false,
      message: `CRITICAL THERMAL DEFICIT: Delivery ${delivery.toFixed(1)}°C (<135°C threshold), Finish ${finish.toFixed(1)}°C (<80°C freeze point), or Plant ${plant.toFixed(1)}°C (>190°C oxidation). Risk of severe aggregate crushing and premature raveling.`,
    };
  }

  if (
    delivery.lessThan(140.0) ||
    finish.lessThan(85.0) ||
    breakdown.lessThan(120.0) ||
    plant.lessThan(150.0) ||
    plant.greaterThan(180.0)
  ) {
    return {
      thermalVerdict: 'COLD_MIX_WARNING',
      isPavingApproved: true,
      message: `THERMAL WARNING: Delivery ${delivery.toFixed(1)}°C (target ≥140°C), Breakdown ${breakdown.toFixed(1)}°C (target 120-140°C), or Finish ${finish.toFixed(1)}°C (target ≥85°C). Accelerate rolling train immediately.`,
    };
  }

  return {
    thermalVerdict: 'COMPLIANT',
    isPavingApproved: true,
    message: 'Asphalt paving temperatures within optimal BS 594987 / KS 02-1025 specifications.',
  };
}

export interface AsphaltCoreEvaluation {
  thicknessDeviationMm: Decimal;
  compactionPercent: Decimal;
  qaVerdict: 'ACCEPTED' | 'CONDITIONAL_PENALTY' | 'REJECTED_UNDER_COMPACTED';
  isAccepted: boolean;
  message: string;
}

export function calculateAsphaltCoreCompaction(
  coreThicknessMm: DecimalValue,
  designThicknessMm: DecimalValue,
  coreDensityGCm3: DecimalValue,
  marshallDensityGCm3: DecimalValue,
): AsphaltCoreEvaluation {
  const coreThick = toDecimal(coreThicknessMm);
  const designThick = toDecimal(designThicknessMm);
  const coreDensity = toDecimal(coreDensityGCm3);
  const marshallDensity = toDecimal(marshallDensityGCm3);

  const thicknessDeviationMm = coreThick.minus(designThick).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const compactionPercent = coreDensity
    .dividedBy(marshallDensity)
    .times(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let qaVerdict: AsphaltCoreEvaluation['qaVerdict'] = 'ACCEPTED';
  let message = 'Core compaction and thickness fully satisfy specification.';

  // Target compaction >= 97.0% per road specification
  if (compactionPercent.lessThan(97.0) || coreThick.lessThan(designThick.minus(3.0))) {
    qaVerdict = 'REJECTED_UNDER_COMPACTED';
    message = `Non-compliant core: Compaction ${compactionPercent.toFixed(2)}% (<97.0%) or Thickness ${coreThick.toFixed(1)}mm (<${designThick.minus(3.0).toFixed(1)}mm min). Milling and overlay required.`;
  } else if (coreThick.lessThan(designThick)) {
    qaVerdict = 'CONDITIONAL_PENALTY';
    message = `Minor thickness deficit (${thicknessDeviationMm.toFixed(1)}mm vs design ${designThick.toFixed(1)}mm): Compaction ${compactionPercent.toFixed(2)}% passed. Subject to contract payment reduction.`;
  }

  return {
    thicknessDeviationMm,
    compactionPercent,
    qaVerdict,
    isAccepted: qaVerdict !== 'REJECTED_UNDER_COMPACTED',
    message,
  };
}

