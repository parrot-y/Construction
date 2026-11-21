import { toDecimal, Decimal } from '@construction/money';

export interface TaxSettings {
  vatPct: Decimal;              // e.g. 16.00 (%)
  whtContractorPct: Decimal;    // client certificates / works contracts
  whtSubcontractorPct: Decimal; // subcontractor valuations
  whtConsultantPct: Decimal;
  whtSupplierPct: Decimal;
  whvatPct: Decimal;             // withholding VAT on goods/services (statutory certs)
}

const DEFAULTS: TaxSettings = {
  vatPct: new Decimal('16.00'),
  whtContractorPct: new Decimal('3.00'),
  whtSubcontractorPct: new Decimal('3.00'),
  whtConsultantPct: new Decimal('3.00'),
  whtSupplierPct: new Decimal('0.00'),
  whvatPct: new Decimal('2.00'),
};

/**
 * Reads the tenant's central tax configuration. Falls back to documented
 * Kenyan defaults when no row exists yet — routes must never hard-code rates.
 */
export async function getTaxSettings(tx: any, tenantId: string): Promise<TaxSettings> {
  const row = await tx.tenantTaxSetting.findUnique({ where: { tenant_id: tenantId } });
  if (!row) return DEFAULTS;
  return {
    vatPct: toDecimal(row.vat_pct.toString()),
    whtContractorPct: toDecimal(row.wht_contractor_pct.toString()),
    whtSubcontractorPct: toDecimal(row.wht_subcontractor_pct.toString()),
    whtConsultantPct: toDecimal(row.wht_consultant_pct.toString()),
    whtSupplierPct: toDecimal(row.wht_supplier_pct.toString()),
    whvatPct: toDecimal(row.whvat_pct?.toString() ?? '2.00'),
  };
}

/** WHT rate for a commitment/valuation vendor category. */
export function whtRateFor(settings: TaxSettings, vendorType?: string | null): Decimal {
  switch ((vendorType ?? '').toUpperCase()) {
    case 'SUBCONTRACTOR':
      return settings.whtSubcontractorPct;
    case 'CONSULTANT':
      return settings.whtConsultantPct;
    case 'SUPPLIER':
      return settings.whtSupplierPct;
    case 'CONTRACTOR':
    default:
      return settings.whtContractorPct;
  }
}
