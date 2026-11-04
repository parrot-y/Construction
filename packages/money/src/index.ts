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

// =============================================================
// TOPOGRAPHIC SURVEY & CUT/FILL EARTHWORKS ENGINE (MILESTONE M31)
// =============================================================

export interface SimpsonRuleResult {
  areaM2: Decimal;
  methodUsed: 'SIMPSONS_1_3_PURE' | 'SIMPSONS_COMPOSITE_TRAPEZOIDAL';
  intervalsCount: number;
}

/**
 * Calculates cross-sectional area using Simpson's 1/3 Rule with parity fallback.
 * Strictly prevents runtime crashes when intervals count is odd or < 2.
 */
export function calculateSimpsonsArea(
  ordinates: DecimalValue[],
  intervalSpacingMeters: DecimalValue
): SimpsonRuleResult {
  const h = toDecimal(intervalSpacingMeters);
  if (h.isZero() || h.isNegative()) {
    throw new Error('Interval spacing must be strictly positive');
  }

  const n = ordinates.length - 1; // number of intervals
  if (n < 1) {
    return { areaM2: new Decimal(0), methodUsed: 'SIMPSONS_1_3_PURE', intervalsCount: 0 };
  }
  if (n === 1) {
    // 1 interval -> pure Trapezoidal
    const y0 = toDecimal(ordinates[0] ?? 0);
    const y1 = toDecimal(ordinates[1] ?? 0);
    const area = h.dividedBy(2).times(y0.plus(y1)).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    return { areaM2: area, methodUsed: 'SIMPSONS_COMPOSITE_TRAPEZOIDAL', intervalsCount: 1 };
  }

  // If n is even, apply pure Simpson's 1/3 Rule
  if (n % 2 === 0) {
    let sumOdd = new Decimal(0);
    let sumEven = new Decimal(0);
    for (let i = 1; i < n; i++) {
      const val = toDecimal(ordinates[i] ?? 0);
      if (i % 2 === 1) {
        sumOdd = sumOdd.plus(val);
      } else {
        sumEven = sumEven.plus(val);
      }
    }
    const y0 = toDecimal(ordinates[0] ?? 0);
    const yn = toDecimal(ordinates[n] ?? 0);
    const area = h
      .dividedBy(3)
      .times(y0.plus(yn).plus(sumOdd.times(4)).plus(sumEven.times(2)))
      .toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

    return { areaM2: area, methodUsed: 'SIMPSONS_1_3_PURE', intervalsCount: n };
  }

  // If n is odd (e.g. 3, 5, 7), evaluate Simpson's 1/3 for first (n-1) intervals,
  // and add Trapezoidal rule for the final interval [n-1, n].
  const simpsonOrdinates = ordinates.slice(0, n); // 0 to n-1 (even count of intervals = n-1)
  const simpsonPart = calculateSimpsonsArea(simpsonOrdinates, h);

  const yPrev = toDecimal(ordinates[n - 1] ?? 0);
  const yLast = toDecimal(ordinates[n] ?? 0);
  const trapezoidPart = h.dividedBy(2).times(yPrev.plus(yLast));

  const totalArea = simpsonPart.areaM2.plus(trapezoidPart).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

  return {
    areaM2: totalArea,
    methodUsed: 'SIMPSONS_COMPOSITE_TRAPEZOIDAL',
    intervalsCount: n,
  };
}

export interface EarthworkPrismoidalVolume {
  averageEndAreaVolumeM3: Decimal;
  prismoidalVolumeM3: Decimal;
  prismoidalCorrectionM3: Decimal;
}

/**
 * Calculates volume between two stations using both Average End-Area and Prismoidal formulas.
 */
export function calculatePrismoidalVolume(
  area1M2: DecimalValue,
  area2M2: DecimalValue,
  distanceMeters: DecimalValue,
  midAreaM2?: DecimalValue | null
): EarthworkPrismoidalVolume {
  const a1 = toDecimal(area1M2);
  const a2 = toDecimal(area2M2);
  const L = toDecimal(distanceMeters);

  if (L.isNegative()) {
    throw new Error('Distance between stations cannot be negative');
  }

  const averageEndAreaVolumeM3 = L.dividedBy(2).times(a1.plus(a2)).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

  let prismoidalVolumeM3: Decimal;
  if (midAreaM2 !== undefined && midAreaM2 !== null) {
    const am = toDecimal(midAreaM2);
    prismoidalVolumeM3 = L.dividedBy(6)
      .times(a1.plus(am.times(4)).plus(a2))
      .toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  } else {
    // Standard geometric root approximation if mid-area not surveyed: Am = ((sqrt(A1) + sqrt(A2)) / 2)^2
    const root1 = new Decimal(Math.sqrt(Math.max(0, a1.toNumber())));
    const root2 = new Decimal(Math.sqrt(Math.max(0, a2.toNumber())));
    const am = root1.plus(root2).dividedBy(2).pow(2);
    prismoidalVolumeM3 = L.dividedBy(6)
      .times(a1.plus(am.times(4)).plus(a2))
      .toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  }

  const prismoidalCorrectionM3 = averageEndAreaVolumeM3.minus(prismoidalVolumeM3).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

  return {
    averageEndAreaVolumeM3,
    prismoidalVolumeM3,
    prismoidalCorrectionM3,
  };
}

export interface MassHaulBalanceResult {
  adjustedFillM3: Decimal;
  netVolumeM3: Decimal;
  looseSpoilVolumeM3: Decimal;
  isSurplusCut: boolean;
}

/**
 * Balances cut and fill volumes considering geotechnical bulking and shrinkage factors.
 * Prevents division-by-zero if shrinkage factor <= 0.
 */
export function calculateEarthworkBalancing(
  cutVolumeM3: DecimalValue,
  fillVolumeM3: DecimalValue,
  shrinkageFactor: DecimalValue = 0.90,
  bulkingFactor: DecimalValue = 1.20
): MassHaulBalanceResult {
  const cut = toDecimal(cutVolumeM3);
  const fill = toDecimal(fillVolumeM3);
  const shrinkage = toDecimal(shrinkageFactor);
  const bulking = toDecimal(bulkingFactor);

  if (shrinkage.isZero() || shrinkage.isNegative()) {
    throw new Error('Geotechnical shrinkage factor must be strictly positive');
  }

  // Compacted fill requires (fill / shrinkage) bank cut
  const adjustedFillM3 = fill.dividedBy(shrinkage).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  const netVolumeM3 = cut.minus(adjustedFillM3).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  const looseSpoilVolumeM3 = cut.times(bulking).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

  return {
    adjustedFillM3,
    netVolumeM3,
    looseSpoilVolumeM3,
    isSurplusCut: netVolumeM3.greaterThanOrEqualTo(0),
  };
}

export interface EconomicHaulEvaluation {
  economicLimitOfHaulMeters: Decimal;
  freehaulDistanceMeters: Decimal;
  overhaulDistanceMeters: Decimal;
  overhaulCostKes: Decimal;
  shouldBorrowLocally: boolean;
}

/**
 * Computes Economic Limit of Haul (ELH) and Overhaul Costs per KeNHA civil engineering standards.
 */
export function calculateEconomicHaul(
  actualHaulDistanceMeters: DecimalValue,
  freehaulDistanceMeters: DecimalValue,
  overhaulVolumeM3: DecimalValue,
  overhaulUnitRateKes: DecimalValue,
  borrowPitUnitRateKes: DecimalValue
): EconomicHaulEvaluation {
  const dist = toDecimal(actualHaulDistanceMeters);
  const fhd = toDecimal(freehaulDistanceMeters);
  const vol = toDecimal(overhaulVolumeM3);
  const overhaulRate = toDecimal(overhaulUnitRateKes);
  const borrowRate = toDecimal(borrowPitUnitRateKes);

  if (overhaulRate.isZero() || overhaulRate.isNegative()) {
    throw new Error('Overhaul unit rate must be strictly positive to compute economic haul limits');
  }

  // ELH = FHD + (Borrow Rate / Overhaul Rate)
  const economicLimitOfHaulMeters = fhd
    .plus(borrowRate.dividedBy(overhaulRate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const overhaulDist = Decimal.max(0, dist.minus(fhd)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // Overhaul Cost = Volume * (Overhaul Distance / 1000 or per station) * Rate
  const overhaulStationKm = overhaulDist.dividedBy(1000);
  const overhaulCostKes = vol.times(overhaulStationKm).times(overhaulRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    economicLimitOfHaulMeters,
    freehaulDistanceMeters: fhd,
    overhaulDistanceMeters: overhaulDist,
    overhaulCostKes,
    shouldBorrowLocally: dist.greaterThan(economicLimitOfHaulMeters),
  };
}

// =============================================================
// MOBILE PLANT CAN-BUS TELEMATICS & FUEL ANOMALY ENGINE (M32)
// =============================================================

export interface FuelSiphoningEvaluation {
  dropLiters: Decimal;
  elapsedSeconds: number;
  dropRateLitersPerHour: Decimal;
  isSiphoning: boolean;
  anomalyType: 'NORMAL' | 'RAPID_THEFT_SIPHON' | 'ACTIVE_SIPHON_IDLE' | 'EXCESSIVE_BURN_THEFT' | 'FUEL_REFUEL_EVENT';
  severity: 'NONE' | 'LOW' | 'HIGH' | 'CRITICAL';
  message: string;
}

export function evaluateFuelSiphoningAnomaly(
  previousFuelLiters: DecimalValue,
  currentFuelLiters: DecimalValue,
  previousTimestamp: Date | string,
  currentTimestamp: Date | string,
  engineStatus: 'RUNNING' | 'IDLE' | 'STOPPED',
  maxEngineBurnRateLph: DecimalValue = 35.00
): FuelSiphoningEvaluation {
  const prevL = toDecimal(previousFuelLiters);
  const currL = toDecimal(currentFuelLiters);
  const maxBurn = toDecimal(maxEngineBurnRateLph);

  const t1 = new Date(previousTimestamp).getTime();
  const t2 = new Date(currentTimestamp).getTime();
  const elapsedSeconds = Math.max(1, Math.floor((t2 - t1) / 1000));
  const elapsedHours = new Decimal(elapsedSeconds).dividedBy(3600);

  const deltaLiters = prevL.minus(currL);

  // If delta is negative, fuel was added (Refuel event)
  if (deltaLiters.lessThan(-10.0)) {
    return {
      dropLiters: deltaLiters,
      elapsedSeconds,
      dropRateLitersPerHour: new Decimal(0),
      isSiphoning: false,
      anomalyType: 'FUEL_REFUEL_EVENT',
      severity: 'NONE',
      message: `Tank refueled: +${deltaLiters.abs().toFixed(1)}L added.`,
    };
  }

  // Calculate hourly consumption rate
  const dropRateLitersPerHour = deltaLiters.greaterThan(0)
    ? deltaLiters.dividedBy(elapsedHours).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(0);

  // 1. Engine STOPPED theft
  if (engineStatus === 'STOPPED' && deltaLiters.greaterThanOrEqualTo(8.0) && elapsedSeconds <= 7200) {
    return {
      dropLiters: deltaLiters.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      elapsedSeconds,
      dropRateLitersPerHour,
      isSiphoning: true,
      anomalyType: 'RAPID_THEFT_SIPHON',
      severity: 'CRITICAL',
      message: `CRITICAL DIESEL THEFT: ${deltaLiters.toFixed(1)}L dropped in ${Math.round(elapsedSeconds / 60)} min while engine STOPPED.`,
    };
  }

  // 2. Engine IDLE theft
  if (engineStatus === 'IDLE' && dropRateLitersPerHour.greaterThan(12.0) && deltaLiters.greaterThanOrEqualTo(5.0)) {
    return {
      dropLiters: deltaLiters.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      elapsedSeconds,
      dropRateLitersPerHour,
      isSiphoning: true,
      anomalyType: 'ACTIVE_SIPHON_IDLE',
      severity: 'CRITICAL',
      message: `ACTIVE SIPHONING AT IDLE: Fuel consumption rate of ${dropRateLitersPerHour.toFixed(1)} L/h exceeds normal idle limit (max 4.0 L/h).`,
    };
  }

  // 3. Engine RUNNING abnormal burn
  const maxPhysicalBurn = maxBurn.times(1.25);
  if (engineStatus === 'RUNNING' && dropRateLitersPerHour.greaterThan(maxPhysicalBurn) && deltaLiters.greaterThanOrEqualTo(10.0)) {
    return {
      dropLiters: deltaLiters.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      elapsedSeconds,
      dropRateLitersPerHour,
      isSiphoning: true,
      anomalyType: 'EXCESSIVE_BURN_THEFT',
      severity: 'HIGH',
      message: `ABNORMAL FUEL LOSS: Measured burn rate ${dropRateLitersPerHour.toFixed(1)} L/h exceeds engine physical maximum (${maxPhysicalBurn.toFixed(1)} L/h). Suspected inline fuel diversion.`,
    };
  }

  return {
    dropLiters: deltaLiters.greaterThan(0) ? deltaLiters.toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : new Decimal(0),
    elapsedSeconds,
    dropRateLitersPerHour,
    isSiphoning: false,
    anomalyType: 'NORMAL',
    severity: 'NONE',
    message: 'Normal fuel consumption pattern verified.',
  };
}

export interface PlantCanBusDiagnostics {
  hasThermalAlarm: boolean;
  hasDtcAlarm: boolean;
  hasElectricalAlarm: boolean;
  alertSeverity: 'NONE' | 'INFO' | 'WARNING' | 'CRITICAL' | 'FATAL_SHUTDOWN';
  faultMessages: string[];
}

export function evaluatePlantCanBusDiagnostics(
  coolantTempC?: DecimalValue | null,
  oilTempC?: DecimalValue | null,
  batteryVoltage?: DecimalValue | null,
  dtcCodes?: string | null
): PlantCanBusDiagnostics {
  const faultMessages: string[] = [];
  let alertSeverity: PlantCanBusDiagnostics['alertSeverity'] = 'NONE';
  let hasThermalAlarm = false;
  let hasDtcAlarm = false;
  let hasElectricalAlarm = false;

  if (coolantTempC !== undefined && coolantTempC !== null) {
    const cTemp = toDecimal(coolantTempC);
    if (cTemp.greaterThan(108.0)) {
      hasThermalAlarm = true;
      alertSeverity = 'FATAL_SHUTDOWN';
      faultMessages.push(`CRITICAL ENGINE OVERHEAT: Coolant temperature ${cTemp.toFixed(1)}°C exceeds emergency shutdown threshold (108°C).`);
    } else if (cTemp.greaterThan(103.0)) {
      hasThermalAlarm = true;
      alertSeverity = 'CRITICAL';
      faultMessages.push(`ENGINE OVERHEAT WARNING: Coolant temperature ${cTemp.toFixed(1)}°C exceeds 103°C limit.`);
    }
  }

  if (oilTempC !== undefined && oilTempC !== null) {
    const oTemp = toDecimal(oilTempC);
    if (oTemp.greaterThan(120.0)) {
      hasThermalAlarm = true;
      if (alertSeverity !== 'FATAL_SHUTDOWN') alertSeverity = 'CRITICAL';
      faultMessages.push(`HIGH OIL TEMPERATURE: Engine oil ${oTemp.toFixed(1)}°C exceeds lubrication safety envelope.`);
    }
  }

  if (batteryVoltage !== undefined && batteryVoltage !== null) {
    const volt = toDecimal(batteryVoltage);
    if (volt.greaterThan(18.0) && volt.lessThan(23.5)) {
      hasElectricalAlarm = true;
      if (alertSeverity === 'NONE') alertSeverity = 'WARNING';
      faultMessages.push(`ELECTRICAL FAULT: 24V supply voltage dropped to ${volt.toFixed(1)}V. Suspected alternator failure.`);
    } else if (volt.lessThan(11.8) && volt.greaterThan(0)) {
      hasElectricalAlarm = true;
      if (alertSeverity === 'NONE') alertSeverity = 'WARNING';
      faultMessages.push(`ELECTRICAL FAULT: 12V supply voltage dropped to ${volt.toFixed(1)}V. Battery draining.`);
    }
  }

  if (dtcCodes && dtcCodes.trim().length > 0) {
    hasDtcAlarm = true;
    if (alertSeverity === 'NONE') alertSeverity = 'WARNING';
    faultMessages.push(`ACTIVE ECU DTC FAULT CODES: ${dtcCodes.trim()}`);
  }

  return {
    hasThermalAlarm,
    hasDtcAlarm,
    hasElectricalAlarm,
    alertSeverity,
    faultMessages,
  };
}

// =============================================================
// MILESTONE M33: INDEPENDENT SITE INSPECTION & TENDER SCORING ENGINE
// =============================================================

export type InspectionVarianceStatus =
  | 'CRITICAL_INFLATION'
  | 'MODERATE_INFLATION'
  | 'ACCEPTABLE_ALIGNMENT'
  | 'CONSERVATIVE_REPORTING';

export interface InspectionProgressVarianceResult {
  variancePct: string;
  status: InspectionVarianceStatus;
  alertRequired: boolean;
  discrepancyMessage: string;
}

/**
 * Calculates progress variance between contractor reported % and independent verified %
 * Delta = verified - reported
 *
 * - Delta <= -10%: CRITICAL_INFLATION (alertRequired = true)
 * - -10% < Delta <= -5%: MODERATE_INFLATION (alertRequired = false)
 * - -5% < Delta < 5%: ACCEPTABLE_ALIGNMENT (alertRequired = false)
 * - Delta >= 5%: CONSERVATIVE_REPORTING (alertRequired = false)
 */
export function calculateInspectionProgressVariance(
  reportedPct: DecimalValue,
  verifiedPct: DecimalValue
): InspectionProgressVarianceResult {
  const rep = toDecimal(reportedPct);
  const ver = toDecimal(verifiedPct);
  const delta = ver.minus(rep);
  const variancePct = delta.toFixed(2);

  let status: InspectionVarianceStatus;
  let alertRequired = false;
  let discrepancyMessage = '';

  if (delta.lessThanOrEqualTo(-10.0)) {
    status = 'CRITICAL_INFLATION';
    alertRequired = true;
    discrepancyMessage = `Critical progress inflation detected: Reported progress (${rep.toFixed(1)}%) exceeds verified progress (${ver.toFixed(1)}%) by ${delta.abs().toFixed(1)}%. Immediate payment withholding recommended.`;
  } else if (delta.lessThanOrEqualTo(-5.0)) {
    status = 'MODERATE_INFLATION';
    alertRequired = false;
    discrepancyMessage = `Moderate progress inflation detected: Reported progress (${rep.toFixed(1)}%) exceeds verified progress (${ver.toFixed(1)}%) by ${delta.abs().toFixed(1)}%. Review site measurement sheets prior to valuation.`;
  } else if (delta.lessThan(5.0)) {
    status = 'ACCEPTABLE_ALIGNMENT';
    alertRequired = false;
    discrepancyMessage = `Acceptable alignment: Progress variance is within allowable construction tolerance (${delta.toFixed(1)}%).`;
  } else {
    status = 'CONSERVATIVE_REPORTING';
    alertRequired = false;
    discrepancyMessage = `Conservative reporting: Verified progress (${ver.toFixed(1)}%) exceeds contractor reported progress (${rep.toFixed(1)}%) by ${delta.toFixed(1)}%.`;
  }

  return {
    variancePct,
    status,
    alertRequired,
    discrepancyMessage,
  };
}

export interface TenderBidInput {
  id: string;
  amountKes: DecimalValue;
  durationWeeks: number;
  technicalScore?: number;
}

export interface EvaluatedTenderBid {
  id: string;
  amountKes: Decimal;
  durationWeeks: number;
  technicalScore: number;
  financialScore: number;
  combinedScore: number;
  rank: number;
  isLowestBid: boolean;
  budgetVarianceKes: Decimal;
}

/**
 * Evaluates contractor tender bids with combined scoring:
 * - 70% Technical weight
 * - 30% Financial weight (based on lowest bid ratio: (Lowest / Bid) * 100)
 *
 * Returns ranked list sorted by combinedScore descending.
 */
export function evaluateTenderBids(
  bids: TenderBidInput[],
  budgetKes: DecimalValue
): EvaluatedTenderBid[] {
  if (!bids || bids.length === 0) {
    return [];
  }

  const budget = toDecimal(budgetKes);

  // Find lowest valid positive bid
  const validBids = bids.filter((b) => toDecimal(b.amountKes).greaterThan(0));
  const minBidAmount = validBids.length > 0
    ? Decimal.min(...validBids.map((b) => toDecimal(b.amountKes)))
    : new Decimal(0);

  const evaluated: EvaluatedTenderBid[] = bids.map((bid) => {
    const amount = toDecimal(bid.amountKes);
    const techScore = bid.technicalScore !== undefined ? toDecimal(bid.technicalScore) : new Decimal(70);

    let financialScore = new Decimal(0);
    if (minBidAmount.greaterThan(0) && amount.greaterThan(0)) {
      financialScore = minBidAmount.dividedBy(amount).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    // 70% technical, 30% financial
    const combinedScore = techScore
      .times(0.70)
      .plus(financialScore.times(0.30))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const isLowestBid = minBidAmount.greaterThan(0) && amount.equals(minBidAmount);
    const budgetVarianceKes = budget.minus(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      id: bid.id,
      amountKes: amount,
      durationWeeks: bid.durationWeeks,
      technicalScore: techScore.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      financialScore: financialScore.toNumber(),
      combinedScore: combinedScore.toNumber(),
      rank: 0, // Assigned after sorting
      isLowestBid,
      budgetVarianceKes,
    };
  });

  // Sort by combinedScore desc, tie-break by amountKes asc
  evaluated.sort((a, b) => {
    if (b.combinedScore !== a.combinedScore) {
      return b.combinedScore - a.combinedScore;
    }
    return a.amountKes.minus(b.amountKes).toNumber();
  });

  // Assign ranks
  evaluated.forEach((b, idx) => {
    b.rank = idx + 1;
  });

  return evaluated;
}

export type ProgressInflationStatus =
  | 'CRITICAL_INFLATION'
  | 'MODERATE_INFLATION'
  | 'ALIGNED'
  | 'CONSERVATIVE_CLAIM';

export interface ProgressInflationResult {
  claimedProgress: Decimal;
  verifiedProgress: Decimal;
  variancePercentage: Decimal; // verified - claimed, e.g. -15.00
  inflationRatePercentage: Decimal; // claimed - verified, e.g. 15.00
  status: ProgressInflationStatus;
  hasInflation: boolean;
  isCritical: boolean;
  alert: string;
  recommendations: string;
}

/**
 * Buildsasa Parity: Evaluates progress inflation between contractor claims and independent inspector findings.
 * E.g., contractor claiming 55% or 65% when inspector verifies 40% or 48% (variance <= -15%) triggers CRITICAL_INFLATION.
 */
export function calculateProgressInflation(
  contractorClaimedProgress: DecimalValue,
  verifiedProgress: DecimalValue,
): ProgressInflationResult {
  const claimed = toDecimal(contractorClaimedProgress);
  const verified = toDecimal(verifiedProgress);

  const variance = verified.minus(claimed).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const inflationRate = claimed.minus(verified).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  if (variance.lessThanOrEqualTo(-15.0)) {
    return {
      claimedProgress: claimed,
      verifiedProgress: verified,
      variancePercentage: variance,
      inflationRatePercentage: inflationRate,
      status: 'CRITICAL_INFLATION',
      hasInflation: true,
      isCritical: true,
      alert: `CRITICAL_INFLATION: Contractor claimed progress (${claimed.toFixed(2)}%) is materially inflated by ${inflationRate.toFixed(2)}% above independently verified site progress (${verified.toFixed(2)}%).`,
      recommendations: 'Withhold interim contractor disbursement. Conduct mandatory joint QS physical remeasurement and audit site delivery dockets against in-situ quantities.',
    };
  }

  if (variance.lessThanOrEqualTo(-5.0)) {
    return {
      claimedProgress: claimed,
      verifiedProgress: verified,
      variancePercentage: variance,
      inflationRatePercentage: inflationRate,
      status: 'MODERATE_INFLATION',
      hasInflation: true,
      isCritical: false,
      alert: `MODERATE_INFLATION: Contractor progress claim (${claimed.toFixed(2)}%) exceeds verified site progress (${verified.toFixed(2)}%) by ${inflationRate.toFixed(2)}%.`,
      recommendations: 'Reconcile contractor progress claim against site supervisor log before certifying interim valuation.',
    };
  }

  if (variance.greaterThanOrEqualTo(5.0)) {
    return {
      claimedProgress: claimed,
      verifiedProgress: verified,
      variancePercentage: variance,
      inflationRatePercentage: inflationRate,
      status: 'CONSERVATIVE_CLAIM',
      hasInflation: false,
      isCritical: false,
      alert: `CONSERVATIVE_CLAIM: Verified progress (${verified.toFixed(2)}%) is ahead of contractor claim (${claimed.toFixed(2)}%) by ${variance.abs().toFixed(2)}%.`,
      recommendations: 'Acknowledge advanced milestone achievement in interim valuation certificate.',
    };
  }

  return {
    claimedProgress: claimed,
    verifiedProgress: verified,
    variancePercentage: variance,
    inflationRatePercentage: inflationRate,
    status: 'ALIGNED',
    hasInflation: false,
    isCritical: false,
    alert: `PROGRESS_ALIGNED: Contractor claim (${claimed.toFixed(2)}%) closely matches independently verified progress (${verified.toFixed(2)}%). Variance is within allowable tolerance.`,
    recommendations: 'Proceed with standard interim valuation and payment processing.',
  };
}

export type DiasporaCurrency = 'KES' | 'USD' | 'GBP' | 'EUR' | 'AED';

export const DIASPORA_EXCHANGE_RATES: Record<DiasporaCurrency, number> = {
  KES: 1.0,
  USD: 129.50,
  GBP: 165.20,
  EUR: 140.80,
  AED: 35.25,
};

/**
 * Converts monetary amounts between supported diaspora currencies (KES, USD, GBP, EUR, AED).
 */
export function convertDiasporaCurrency(
  amount: DecimalValue,
  fromCurrency: DiasporaCurrency | string,
  toCurrency: DiasporaCurrency | string,
  customRates?: Partial<Record<DiasporaCurrency, number>>,
): Decimal {
  const from = fromCurrency.toUpperCase() as DiasporaCurrency;
  const to = toCurrency.toUpperCase() as DiasporaCurrency;
  const amt = toDecimal(amount);

  if (from === to) {
    return amt.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  const rates: Record<string, number> = { ...DIASPORA_EXCHANGE_RATES, ...customRates };
  const fromRate = rates[from] || 1.0;
  const toRate = rates[to] || 1.0;

  // Convert to KES base first, then to target currency
  const inKes = amt.times(fromRate);
  const converted = inKes.dividedBy(toRate);

  return converted.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Formats monetary amounts with the corresponding currency symbol/prefix.
 */
export function formatDiasporaCurrency(
  amount: DecimalValue,
  currency: DiasporaCurrency | string,
): string {
  const c = currency.toUpperCase();
  const amtStr = toDecimal(amount).toFixed(2, Decimal.ROUND_HALF_UP);
  switch (c) {
    case 'USD':
      return `$${amtStr}`;
    case 'GBP':
      return `£${amtStr}`;
    case 'EUR':
      return `€${amtStr}`;
    case 'AED':
      return `AED ${amtStr}`;
    case 'KES':
    default:
      return `KES ${amtStr}`;
  }
}



