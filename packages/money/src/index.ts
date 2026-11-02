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
