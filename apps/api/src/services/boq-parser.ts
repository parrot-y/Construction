import ExcelJS from 'exceljs';
import { calculateLineTotal, toCurrencyString, toDecimal, Decimal } from '@construction/money';

export interface ParsedBOQItem {
  itemCode: string;
  description: string;
  unit: string;
  quantity: string;
  unitRate: string;
  totalAmount: string;
  isProvisional: boolean;
  status: 'VALID' | 'WARNING' | 'REJECTED';
  rejectionReason?: string;
}

export interface ParsedBOQSection {
  title: string;
  orderIdx: number;
  subtotal: string;
  items: ParsedBOQItem[];
}

export interface BOQPreviewResult {
  sourceFilename: string;
  totalSections: number;
  totalItems: number;
  validItemsCount: number;
  warningItemsCount: number;
  rejectedItemsCount: number;
  calculatedGrandTotal: string;
  declaredGrandTotal?: string;
  sections: ParsedBOQSection[];
}

interface ColumnIndexMap {
  codeIdx: number;
  descIdx: number;
  unitIdx: number;
  qtyIdx: number;
  rateIdx: number;
  amountIdx: number;
}

/**
 * Cleans string representation of cell values and extracts plain text.
 */
function extractCellString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();

  // ExcelJS formula result: { formula: '...', result: 1234 }
  if (typeof value === 'object') {
    if ('result' in value && value.result !== undefined && value.result !== null) {
      return extractCellString(value.result as ExcelJS.CellValue);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text || '').join('').trim();
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text.trim();
    }
  }

  return String(value).trim();
}

/**
 * Cleans numerical currency inputs, stripping out KES symbols, commas, and trailing /=
 */
function cleanNumericString(raw: string): string {
  if (!raw) return '';
  // Remove currency signs, commas, /=, and whitespace
  const cleaned = raw
    .replace(/KSh/gi, '')
    .replace(/KES/gi, '')
    .replace(/\/\=/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim();
  return cleaned;
}

/**
 * Detects whether a string is a section header (e.g. "SECTION 2: SUBSTRUCTURE")
 */
function isSectionHeader(text: string): boolean {
  const upper = text.toUpperCase();
  return (
    upper.startsWith('SECTION') ||
    upper.startsWith('BILL NO') ||
    upper.startsWith('ELEMENT') ||
    upper.startsWith('PART') ||
    upper.includes('SUBSTRUCTURE') ||
    upper.includes('SUPERSTRUCTURE') ||
    upper.includes('PRELIMINARIES') ||
    upper.includes('FINISHES') ||
    upper.includes('EXTERNAL WORKS') ||
    upper.includes('DRAINAGE')
  );
}

/**
 * Detects whether a string is a collection/subtotal summary row
 */
function isSubtotalOrCollection(text: string): boolean {
  const upper = text.toUpperCase();
  return (
    upper.includes('TOTAL CARRIED TO') ||
    upper.includes('TOTAL CARRIED FORWARD') ||
    upper.includes('TOTAL BROUGHT FORWARD') ||
    upper.includes('SUB-TOTAL') ||
    upper.includes('SUBTOTAL') ||
    upper.includes('COLLECTION') ||
    upper.startsWith('TOTAL')
  );
}

/**
 * Detects column mapping from header row candidates
 */
function detectColumnMapping(rowValues: string[]): ColumnIndexMap | null {
  let codeIdx = -1;
  let descIdx = -1;
  let unitIdx = -1;
  let qtyIdx = -1;
  let rateIdx = -1;
  let amountIdx = -1;

  for (let i = 0; i < rowValues.length; i++) {
    const header = (rowValues[i] || '').toLowerCase();
    if (header.includes('item') && (header.includes('no') || header.includes('code') || header.includes('ref')) && codeIdx === -1) {
      codeIdx = i;
    } else if ((header.includes('desc') || header.includes('particular') || header.includes('specification')) && descIdx === -1) {
      descIdx = i;
    } else if ((header === 'unit' || header === 'uom' || header.includes('unit')) && unitIdx === -1) {
      unitIdx = i;
    } else if ((header === 'qty' || header === 'quantity' || header.includes('qty')) && qtyIdx === -1) {
      qtyIdx = i;
    } else if ((header === 'rate' || header === 'unit rate' || header.includes('rate') || header === 'price') && rateIdx === -1) {
      rateIdx = i;
    } else if ((header === 'amount' || header === 'total' || header.includes('amount') || header.includes('ksh') || header.includes('kes')) && amountIdx === -1) {
      amountIdx = i;
    }
  }

  // Must have at least description and either amount or rate/qty to be considered a header row
  if (descIdx !== -1 && (amountIdx !== -1 || (qtyIdx !== -1 && rateIdx !== -1))) {
    // If code index not found, default to column 0 if desc is column 1
    if (codeIdx === -1 && descIdx > 0) codeIdx = 0;
    // If unit index not found, look for reasonable default
    return { codeIdx, descIdx, unitIdx, qtyIdx, rateIdx, amountIdx };
  }

  return null;
}

/**
 * Parses an Excel BOQ workbook buffer into a validated preview structure
 */
export async function parseBOQWorkbook(
  buffer: Buffer,
  filename: string,
): Promise<BOQPreviewResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel workbook contains no valid worksheets');
  }

  let columnMap: ColumnIndexMap | null = null;
  let headerRowIndex = -1;

  // Search for the header row among the first 25 rows
  for (let r = 1; r <= Math.min(25, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const rowValues: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      rowValues.push(extractCellString(cell.value));
    });

    const detected = detectColumnMapping(rowValues);
    if (detected) {
      columnMap = detected;
      headerRowIndex = r;
      break;
    }
  }

  // Fallback default column mapping if no standard header row was discovered
  if (!columnMap) {
    columnMap = {
      codeIdx: 0,
      descIdx: 1,
      unitIdx: 2,
      qtyIdx: 3,
      rateIdx: 4,
      amountIdx: 5,
    };
    headerRowIndex = 1;
  }

  const sections: ParsedBOQSection[] = [];
  let currentSection: ParsedBOQSection = {
    title: 'General & Preliminaries',
    orderIdx: 1,
    subtotal: '0.00',
    items: [],
  };

  let validItemsCount = 0;
  let warningItemsCount = 0;
  let rejectedItemsCount = 0;
  let grandTotalDecimal = new Decimal(0);

  // Iterate over data rows starting after the header
  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const rawValues: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      rawValues.push(extractCellString(cell.value));
    });

    if (rawValues.length === 0 || rawValues.every((v) => !v)) {
      continue; // Skip entirely empty rows
    }

    const descRaw = rawValues[columnMap.descIdx] || '';
    const codeRaw = columnMap.codeIdx !== -1 ? rawValues[columnMap.codeIdx] || '' : '';
    const unitRaw = columnMap.unitIdx !== -1 ? (rawValues[columnMap.unitIdx] || '').toUpperCase() : '';
    const qtyStr = columnMap.qtyIdx !== -1 ? cleanNumericString(rawValues[columnMap.qtyIdx] || '') : '';
    const rateStr = columnMap.rateIdx !== -1 ? cleanNumericString(rawValues[columnMap.rateIdx] || '') : '';
    const amountStr = columnMap.amountIdx !== -1 ? cleanNumericString(rawValues[columnMap.amountIdx] || '') : '';

    // Check if this row is a collection / subtotal row
    if (isSubtotalOrCollection(descRaw)) {
      continue;
    }

    // Check if this row is a new section header
    if (isSectionHeader(descRaw) || (descRaw && !qtyStr && !rateStr && !amountStr && descRaw.length < 100)) {
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
        currentSection = {
          title: descRaw,
          orderIdx: sections.length + 1,
          subtotal: '0.00',
          items: [],
        };
      } else {
        currentSection.title = descRaw;
      }
      continue;
    }

    // If description is empty and no amount or code, skip
    if (!descRaw && !amountStr) {
      continue;
    }

    // Evaluate line item status
    let status: 'VALID' | 'WARNING' | 'REJECTED' = 'VALID';
    let rejectionReason: string | undefined;
    let isProvisional = false;
    let finalQty = '0.0000';
    let finalRate = '0.0000';
    let finalAmount = '0.00';

    if (!descRaw) {
      status = 'REJECTED';
      rejectionReason = 'Line item description is required';
      rejectedItemsCount++;
    } else {
      // Check for Provisional Sum
      if (amountStr && (!qtyStr || toDecimal(qtyStr || 0).isZero()) && (!rateStr || toDecimal(rateStr || 0).isZero())) {
        try {
          const amtDec = toDecimal(amountStr);
          if (amtDec.isNegative()) {
            status = 'REJECTED';
            rejectionReason = 'Provisional sum cannot be negative';
            rejectedItemsCount++;
          } else {
            isProvisional = true;
            finalAmount = toCurrencyString(amtDec);
            validItemsCount++;
          }
        } catch {
          status = 'REJECTED';
          rejectionReason = `Invalid provisional sum format: ${amountStr}`;
          rejectedItemsCount++;
        }
      } else {
        // Standard item with Quantity and Unit Rate
        try {
          const qtyDec = toDecimal(qtyStr || 0);
          const rateDec = toDecimal(rateStr || 0);

          if (qtyDec.isNegative() || rateDec.isNegative()) {
            status = 'REJECTED';
            rejectionReason = 'Negative quantities or unit rates are forbidden';
            rejectedItemsCount++;
          } else {
            finalQty = qtyDec.toFixed(4);
            finalRate = rateDec.toFixed(4);
            const calculatedTotal = calculateLineTotal(qtyDec, rateDec);
            finalAmount = toCurrencyString(calculatedTotal);

            // Arithmetic Discrepancy Check against spreadsheet declared amount
            if (amountStr) {
              try {
                const sheetAmountDec = toDecimal(amountStr);
                const diff = calculatedTotal.minus(sheetAmountDec).abs();
                if (diff.greaterThan(0.05)) {
                  status = 'WARNING';
                  rejectionReason = `Arithmetic discrepancy: calculated ${finalAmount} (qty ${finalQty} × rate ${finalRate}) differs from sheet value (${toCurrencyString(sheetAmountDec)}) by KES ${toCurrencyString(diff)}`;
                  warningItemsCount++;
                } else {
                  validItemsCount++;
                }
              } catch {
                status = 'WARNING';
                rejectionReason = `Unparseable spreadsheet amount: "${amountStr}". Used calculated total ${finalAmount}.`;
                warningItemsCount++;
              }
            } else {
              validItemsCount++;
            }
          }
        } catch (err) {
          status = 'REJECTED';
          rejectionReason = `Unparseable quantity or rate: ${(err as Error).message}`;
          rejectedItemsCount++;
        }
      }
    }

    if (status !== 'REJECTED') {
      grandTotalDecimal = grandTotalDecimal.plus(finalAmount);
      const currentSubtotal = toDecimal(currentSection.subtotal).plus(finalAmount);
      currentSection.subtotal = toCurrencyString(currentSubtotal);
    }

    currentSection.items.push({
      itemCode: codeRaw || `${currentSection.orderIdx}.${currentSection.items.length + 1}`,
      description: descRaw,
      unit: unitRaw || (isProvisional ? 'SUM' : 'ITEM'),
      quantity: finalQty,
      unitRate: finalRate,
      totalAmount: finalAmount,
      isProvisional,
      status,
      rejectionReason,
    });
  }

  // Push final section
  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return {
    sourceFilename: filename,
    totalSections: sections.length,
    totalItems: sections.reduce((acc, s) => acc + s.items.length, 0),
    validItemsCount,
    warningItemsCount,
    rejectedItemsCount,
    calculatedGrandTotal: toCurrencyString(grandTotalDecimal),
    sections,
  };
}