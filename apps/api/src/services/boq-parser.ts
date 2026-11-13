import stream from 'stream';
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
  sectionIdx?: number;
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
 * Standard EASMM section mappings for common Kenyan BOQ section codes
 */
const EASMM_SECTION_MAP: Record<string, string> = {
  SECTION_01: 'Section 1: Substructure & Groundworks',
  SECTION_02: 'Section 2: Superstructure Concrete & Walling',
  SECTION_03: 'Section 3: Roofing & Structural Steel',
  SECTION_04: 'Section 4: Finishes & Surface Treatments',
  SECTION_05: 'Section 5: Provisional Sums & MEP Services',
  BILL_01: 'Bill No. 1: Preliminaries & General Conditions',
  BILL_02: 'Bill No. 2: Substructure & Earthworks',
  BILL_03: 'Bill No. 3: Reinforced Concrete Superstructure',
  BILL_04: 'Bill No. 4: Walling & Partitions',
  BILL_05: 'Bill No. 5: Roofing & Rainwater Goods',
  BILL_06: 'Bill No. 6: Finishes',
};

/**
 * Detects column mapping from header row candidates
 */
function detectColumnMapping(rowValues: string[]): ColumnIndexMap | null {
  let sectionIdx = -1;
  let codeIdx = -1;
  let descIdx = -1;
  let unitIdx = -1;
  let qtyIdx = -1;
  let rateIdx = -1;
  let amountIdx = -1;

  for (let i = 0; i < rowValues.length; i++) {
    const header = (rowValues[i] || '').toLowerCase();
    if ((header.includes('section') || header.includes('bill_no') || header.includes('bill no')) && sectionIdx === -1) {
      sectionIdx = i;
    } else if (header.includes('item') && (header.includes('no') || header.includes('code') || header.includes('ref')) && codeIdx === -1) {
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
    return { sectionIdx, codeIdx, descIdx, unitIdx, qtyIdx, rateIdx, amountIdx };
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
  const isCsv = filename.toLowerCase().endsWith('.csv') ||
    (buffer.length >= 4 && !buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])));

  if (isCsv) {
    await workbook.csv.read(stream.Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer as any);
  }

  if (workbook.worksheets.length === 0) {
    throw new Error('Excel workbook contains no valid worksheets');
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
  let lastSectionCode = '';

  // F3: messy Kenyan BoQs are often split bill-by-bill across worksheets.
  // Every sheet is scanned with the same state so items from all bills
  // land in one continuous section/item stream.
  for (const worksheet of workbook.worksheets) {
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
      sectionIdx: -1,
      codeIdx: 0,
      descIdx: 1,
      unitIdx: 2,
      qtyIdx: 3,
      rateIdx: 4,
      amountIdx: 5,
    };
    headerRowIndex = 1;
  }

  // F3: index merged cell ranges so item rows sitting inside a merge
  // (common in messy Kenyan BoQs where a section title is merged across
  // columns, or a description is merged over quantity rows) can be
  // flagged row-by-row instead of silently mis-parsed.
  const colToNum = (letters: string): number => {
    let n = 0;
    for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  };
  const mergeRanges: Array<{ top: number; left: number; bottom: number; right: number }> = [];
  const rawMerges = (worksheet.model as { merges?: unknown[] }).merges;
  if (Array.isArray(rawMerges)) {
    for (const ref of rawMerges) {
      let range: { top: number; left: number; bottom: number; right: number } | null = null;
      if (typeof ref === 'string') {
        const m = ref.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
        if (m) {
          range = {
            left: colToNum(m[1]!),
            top: parseInt(m[2]!, 10),
            right: m[3] ? colToNum(m[3]) : colToNum(m[1]!),
            bottom: m[4] ? parseInt(m[4], 10) : parseInt(m[2]!, 10),
          };
        }
      } else if (ref && typeof ref === 'object') {
        const o = ref as { top?: number; left?: number; bottom?: number; right?: number };
        if (o.top != null && o.left != null && o.bottom != null && o.right != null) {
          range = { top: o.top, left: o.left, bottom: o.bottom, right: o.right };
        }
      }
      if (range && (range.top !== range.bottom || range.left !== range.right)) {
        mergeRanges.push(range);
      }
    }
  }
  const isMergedCell = (rowNum: number, colNum: number): boolean =>
    mergeRanges.some((rg) => rowNum >= rg.top && rowNum <= rg.bottom && colNum >= rg.left && colNum <= rg.right);

  // Iterate over data rows starting after the header
  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const rawValues: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const c = cell as unknown as { isMerged?: boolean; master?: unknown };
      const isMergeEcho = c.isMerged === true && c.master !== undefined && c.master !== cell;
      rawValues.push(isMergeEcho ? '' : extractCellString(cell.value));
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
    const sectionRaw = (columnMap.sectionIdx !== undefined && columnMap.sectionIdx !== -1)
      ? (rawValues[columnMap.sectionIdx] || '').trim()
      : '';

    // Check if this row is a collection / subtotal row
    if (isSubtotalOrCollection(descRaw)) {
      continue;
    }

    // Check if section_code column indicated a section transition
    if (sectionRaw && sectionRaw !== lastSectionCode) {
      lastSectionCode = sectionRaw;
      const sectionTitle = EASMM_SECTION_MAP[sectionRaw.toUpperCase()] || sectionRaw;
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
        currentSection = {
          title: sectionTitle,
          orderIdx: sections.length + 1,
          subtotal: '0.00',
          items: [],
        };
      } else {
        currentSection.title = sectionTitle;
      }
    }

    // Check if this row is a new section header
    const hasNoQtyOrRate = (!qtyStr || qtyStr === '0') && (!rateStr || rateStr === '0');
    if (hasNoQtyOrRate && (isSectionHeader(descRaw) || (descRaw && !amountStr && descRaw.length < 100))) {
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

    // F3 row-by-row problem detection (dry-run reports these without saving):
    // merged description cells, prime-cost items, and missing units.
    const mergedFlags: string[] = [];
    if (isMergedCell(r, columnMap.descIdx + 1)) {
      mergedFlags.push('merged-cell');
    }
    const PRIME_COST_RE = /prime\s*cost|p\.?\s*c\.?\s*(sum|item|sums)|provisional\s+sum|as\s+per\s+(architect|engineer|instruction)/i;
    const isPrimeCost = PRIME_COST_RE.test(descRaw);
    const missingUnit = !unitRaw && !(columnMap.unitIdx === -1);

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

    // Prime-cost / provisional-sum language marks the row as a sum-type item
    // (kept VALID — Kenyan BOQs price PC sums as qty x rate or amount-only);
    // the dry-run report surfaces them via isProvisional, not as warnings.
    if (isPrimeCost && status !== 'REJECTED') isProvisional = true;

    // Apply F3 advisory flags — never downgrade a REJECTED row, and a row
    // may accumulate multiple problems.
    if (status !== 'REJECTED') {
      const advisories: string[] = [];
      if (mergedFlags.length > 0) advisories.push('Row sits inside a merged cell range — verify this description/quantity applies to this row only');
      if (missingUnit && !isProvisional) advisories.push('Missing unit of measure — defaulted, please correct in source document');
      if (advisories.length > 0) {
        if (status === 'VALID') {
          status = 'WARNING';
          warningItemsCount++;
          validItemsCount = Math.max(0, validItemsCount - 1);
        }
        rejectionReason = [rejectionReason, ...advisories].filter(Boolean).join(' | ');
      }
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

  } // end per-worksheet scan

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