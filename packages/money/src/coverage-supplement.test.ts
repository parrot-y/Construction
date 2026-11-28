import { describe, expect, it } from 'vitest';
import {
  calculateProgressInflation,
  convertDiasporaCurrency,
  formatDiasporaCurrency,
  evaluateTenderBids,
  getStructuralSteelSection,
  calculateSimpsonsArea,
  calculatePrismoidalVolume,
  calculateEarthworkBalancing,
  calculateEconomicHaul,
  evaluatePlantCanBusDiagnostics,
  calculateInspectionProgressVariance,
  evaluateRmcSlumpTolerance,
  evaluateAsphaltThermalQuality,
  calculateAsphaltCoreCompaction,
  calculateStructuralMemberTotals,
  getRebarUnitWeight,
  evaluateFuelDiscrepancyAnomaly,
} from './index';

describe('coverage supplement — money domain branches', () => {
  it('calculateProgressInflation covers all four statuses', () => {
    expect(calculateProgressInflation('55', '40').status).toBe('CRITICAL_INFLATION');
    expect(calculateProgressInflation('52', '45').status).toBe('MODERATE_INFLATION');
    expect(calculateProgressInflation('50', '56').status).toBe('CONSERVATIVE_CLAIM');
    expect(calculateProgressInflation('50', '51').status).toBe('ALIGNED');
    const c = calculateProgressInflation('55', '40');
    expect(c.isCritical).toBe(true);
    expect(c.alert).toContain('CRITICAL_INFLATION');
  });

  it('diaspora currency convert + format', () => {
    expect(convertDiasporaCurrency('100', 'USD', 'USD').toFixed(2)).toBe('100.00');
    expect(convertDiasporaCurrency('100', 'USD', 'KES').greaterThan('0')).toBe(true);
    expect(convertDiasporaCurrency('100', 'XXX', 'KES').greaterThanOrEqualTo('0')).toBe(true);
    expect(formatDiasporaCurrency('10', 'USD')).toBe('$10.00');
    expect(formatDiasporaCurrency('10', 'GBP')).toBe('£10.00');
    expect(formatDiasporaCurrency('10', 'EUR')).toBe('€10.00');
    expect(formatDiasporaCurrency('10', 'AED')).toBe('AED 10.00');
    expect(formatDiasporaCurrency('10', 'KES')).toBe('KES 10.00');
  });

  it('evaluateTenderBids ranks and flags lowest', () => {
    const bids = evaluateTenderBids([
      { id: 'a', amountKes: '1000000', durationWeeks: 20, technicalScore: 80 },
      { id: 'b', amountKes: '900000', durationWeeks: 22, technicalScore: 90 },
      { id: 'c', amountKes: '0', durationWeeks: 30 },
    ], '1500000');
    expect(bids.length).toBe(3);
    expect(bids[0]!.rank).toBe(1);
    expect(bids.some((b) => b.isLowestBid)).toBe(true);
    expect(evaluateTenderBids([], '100')).toEqual([]);
  });

  it('getStructuralSteelSection fallback + known designation', () => {
    expect(getStructuralSteelSection('UB203X133X25').unitWeightKgPerM).toBeTruthy();
    const f = getStructuralSteelSection('XX999');
    expect(f.unitWeightKgPerM).toBe('25.000');
    expect(getStructuralSteelSection('uc254x254x73').type).toBeTruthy();
    expect(getStructuralSteelSection('RHS200X100X8').type).toBe('RHS');
  });

  it('calculateSimpsonsArea edge cases', () => {
    expect(() => calculateSimpsonsArea([1], 1)).not.toThrow();
    expect(calculateSimpsonsArea([0, 10], 2).areaM2.toNumber()).toBeCloseTo(10, 1);
    const odd = calculateSimpsonsArea([0, 5, 10, 5, 0], 2); // 4 intervals even
    expect(odd.methodUsed).toContain('SIMPSONS');
    const three = calculateSimpsonsArea([0, 4, 4, 0], 2); // 3 intervals odd
    expect(three.intervalsCount).toBe(3);
    expect(() => calculateSimpsonsArea([1, 2], 0)).toThrow();
  });

  it('prismoidal + earthwork balancing edge paths', () => {
    expect(() => calculatePrismoidalVolume('10', '10', '-1')).toThrow();
    const noMid = calculatePrismoidalVolume('100', '100', '50');
    expect(noMid.prismoidalVolumeM3.toNumber()).toBeGreaterThan(0);
    const withMid = calculatePrismoidalVolume('100', '100', '50', '100');
    expect(withMid.prismoidalVolumeM3.toNumber()).toBeGreaterThan(0);
    expect(() => calculateEarthworkBalancing('10', '10', '0')).toThrow();
    const bal = calculateEarthworkBalancing('1000', '500', '0.9', '1.2');
    expect(bal.netVolumeM3.toNumber()).toBeGreaterThan(0);
  });

  it('economic haul validation', () => {
    expect(() => calculateEconomicHaul('5', '5', '100', '0', '100')).toThrow();
    const r = calculateEconomicHaul('5000', '1000', '200', '500', '300');
    expect(r.economicLimitOfHaulMeters.toNumber()).toBeGreaterThan(1000);
  });

  it('plant CAN bus diagnostics alarm branches', () => {
    const fatal = evaluatePlantCanBusDiagnostics(115, 130, 20, 'P0420');
    expect(fatal.alertSeverity).toBe('FATAL_SHUTDOWN');
    expect(fatal.hasThermalAlarm).toBe(true);
    const warn = evaluatePlantCanBusDiagnostics(105, 125, 20);
    expect(warn.alertSeverity).toBe('CRITICAL');
    const elec = evaluatePlantCanBusDiagnostics(90, 90, 20);
    expect(elec.hasElectricalAlarm).toBe(true);
    const low = evaluatePlantCanBusDiagnostics(90, 90, 10);
    expect(low.hasElectricalAlarm).toBe(true);
    const dtc = evaluatePlantCanBusDiagnostics(null, null, null, 'C1234');
    expect(dtc.hasDtcAlarm).toBe(true);
    const ok = evaluatePlantCanBusDiagnostics(85, 95, 13.8);
    expect(ok.alertSeverity).toBe('NONE');
  });

  it('inspection progress variance statuses', () => {
    expect(calculateInspectionProgressVariance('55', '40').status).toBe('CRITICAL_INFLATION');
    expect(calculateInspectionProgressVariance('52', '45').status).toBe('MODERATE_INFLATION');
    expect(calculateInspectionProgressVariance('50', '56').status).toBe('CONSERVATIVE_REPORTING');
    expect(calculateInspectionProgressVariance('50', '51').status).toBe('ACCEPTABLE_ALIGNMENT');
    expect(calculateInspectionProgressVariance('55', '40').alertRequired).toBe(true);
  });

  it('RMC slump tolerances + thermal + core compaction + member totals', () => {
    expect(evaluateRmcSlumpTolerance(80, 95).allowedToleranceMm).toBe(20);
    expect(evaluateRmcSlumpTolerance(120, 130).allowedToleranceMm).toBe(25);
    expect(evaluateRmcSlumpTolerance(200, 215).allowedToleranceMm).toBe(30);
    expect(evaluateAsphaltThermalQuality(170, 100, 130, 70).isPavingApproved).toBe(false);
    expect(evaluateAsphaltThermalQuality(170, 145, 130, 90).thermalVerdict).toBe('COMPLIANT');
    expect(evaluateAsphaltThermalQuality(160, 138, 125, 88).thermalVerdict).toBe('COLD_MIX_WARNING');
    const core = calculateAsphaltCoreCompaction('50', '50', '2.35', '2.40');
    expect(core.compactionPercent.toNumber()).toBeGreaterThan(90);
    const totals = calculateStructuralMemberTotals('10', 4, '25', '1.5');
    expect(totals.totalWeightKg.toNumber()).toBe(1000);
  });

  it('rebar unit weight error + fuel anomaly', () => {
    expect(() => getRebarUnitWeight('Y99')).toThrow();
    expect(getRebarUnitWeight('y16').toNumber()).toBeCloseTo(1.579, 3);
    const now = new Date();
    const past = new Date(now.getTime() - 3600_000);
    const fuel = evaluateFuelDiscrepancyAnomaly('100', '50', past, now, 'RUNNING');
    expect(fuel).toBeTruthy();
  });
});
