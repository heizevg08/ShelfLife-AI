import type { ReportExportService, ReportTable } from './report-export';
import type { ReportId, ReportQuery } from '../validators/report';

type WorkbookField = { label: string; index?: number; publicId?: true };
type WorkbookSheet = { name: string; id: ReportId; ingredientIdIndex: number; fields: WorkbookField[] };
const sheets: WorkbookSheet[] = [
  { name: 'Inventory Summary', id: 'inventory-summary', ingredientIdIndex: 2, fields: [
    { label: 'Ingredient ID', publicId: true }, { label: 'Ingredient', index: 3 }, { label: 'Batch ID', index: 5 }, { label: 'Category', index: 4 },
    { label: 'On Hand', index: 6 }, { label: 'Unit', index: 7 }, { label: 'Expiry Date', index: 8 }, { label: 'Unit Cost (PHP)', index: 9 },
    { label: 'Unit Cost Source', index: 10 }, { label: 'Inventory Value (PHP)', index: 11 }, { label: 'Record Notes', index: 12 },
  ] },
  { name: 'Usage & Consumption', id: 'usage-consumption', ingredientIdIndex: 1, fields: [
    { label: 'Ingredient ID', publicId: true }, { label: 'Ingredient', index: 2 }, { label: 'Usage Date', index: 0 },
    { label: 'Quantity Used', index: 4 }, { label: 'Unit', index: 3 }, { label: 'Record Notes', index: 6 },
  ] },
  { name: 'Expiration & Waste', id: 'expiration-waste', ingredientIdIndex: 4, fields: [
    { label: 'Ingredient ID', publicId: true }, { label: 'Ingredient', index: 5 }, { label: 'Batch ID', index: 6 }, { label: 'Expiry Date', index: 7 },
    { label: 'On Hand', index: 8 }, { label: 'Quantity Wasted', index: 11 }, { label: 'Unit', index: 9 },
    { label: 'Waste Cost (PHP)', index: 12 }, { label: 'Record Notes', index: 13 },
  ] },
];
const columnWidths: Record<string, number> = {
  'Ingredient ID': 18, Ingredient: 28, 'Batch ID': 22, Category: 18, 'On Hand': 15, Unit: 12,
  'Expiry Date': 16, 'Usage Date': 16, 'Quantity Used': 17, 'Quantity Wasted': 18,
  'Unit Cost (PHP)': 18, 'Unit Cost Source': 22, 'Inventory Value (PHP)': 22, 'Waste Cost (PHP)': 19, 'Record Notes': 40,
};
const numericFields = new Set(['On Hand', 'Quantity Used', 'Quantity Wasted', 'Unit Cost (PHP)', 'Inventory Value (PHP)', 'Waste Cost (PHP)']);
const dateFields = new Set(['Usage Date', 'Expiry Date']);

function reportNote(value: string | number | null): string | null {
  if (value === null || value === 'Complete') return null;
  const descriptions: Record<string, string> = {
    'Missing ingredient reference': 'Ingredient record unavailable',
    'Missing batch reference': 'Batch record unavailable',
    'Ingredient reference mismatch': 'Batch and ingredient do not match',
    'Unit mismatch': 'Batch and waste units do not match',
    'Missing unit cost': 'Unit cost unavailable',
    Unavailable: 'Recorded inventory total unavailable because some costs are missing',
  };
  return descriptions[String(value)] ?? String(value);
}

function safeCell(value: string | number | null, isDate: boolean): string | number | Date | null {
  if (value === null || typeof value === 'number') return value;
  if (isDate && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`);
  return /^[\s\u0000-\u001f]*[=+\-@]/u.test(value) ? `'${value}` : value;
}

function reportTimestamp(value: Date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(value);
}

export async function reportWorkbook(service: ReportExportService, period: ReportQuery, now = new Date(), selectedReport?: ReportId) {
  const { Workbook } = (await import('@excel.js/exceljs')).default;
  const workbook = new Workbook();
  const tables: ReportTable[] = [];
  const selectedSheets = selectedReport ? sheets.filter(sheet => sheet.id === selectedReport) : sheets;
  for (const sheet of selectedSheets) {
    const query: ReportQuery = sheet.id === 'inventory-summary' ? { reportId: sheet.id } : { ...period, reportId: sheet.id };
    const table = await service.table(query, now);
    tables.push(table);
    const internalIds = table.rows.flatMap(row => typeof row[sheet.ingredientIdIndex] === 'string' ? [row[sheet.ingredientIdIndex] as string] : []);
    const publicCodes = await service.ingredientCodesForIds(internalIds);
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.addRow([sheet.name]).font = { name: 'Inter', size: 14, bold: true, color: { argb: 'FF173D2B' } };
    worksheet.addRow(['Report Prepared At (Philippine Time)', reportTimestamp(now)]).font = { name: 'Inter', size: 9, color: { argb: 'FF667C6C' } };
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(sheet.fields.map(field => field.label));
    headerRow.font = { name: 'Inter', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF11613C' } };
    headerRow.alignment = { vertical: 'middle' };
    worksheet.views = [{ state: 'frozen', ySplit: 4 }];
    sheet.fields.forEach((field, index) => {
      worksheet.getColumn(index + 1).width = columnWidths[field.label] ?? 16;
      if (dateFields.has(field.label)) worksheet.getColumn(index + 1).numFmt = 'yyyy-mm-dd';
      if (numericFields.has(field.label)) worksheet.getColumn(index + 1).numFmt = '#,##0.00';
    });
    for (const row of table.rows) {
      const values = sheet.fields.map(field => {
        if (field.publicId) {
          const internalId = row[sheet.ingredientIdIndex];
          const code = typeof internalId === 'string' ? publicCodes.get(internalId) ?? null : null;
          return safeCell(code, false);
        }
        const value = row[field.index!];
        if (sheet.id === 'inventory-summary' && row[0] === 'SUMMARY' && field.label === 'Ingredient') return 'Recorded Inventory Total';
        if (sheet.id === 'inventory-summary' && field.label === 'Record Notes' && row[0] === 'BATCH' && row[9] === null && row[12] === 'Missing ingredient reference') return 'Ingredient record unavailable; unit cost unavailable';
        const mapped = field.label === 'Record Notes' ? reportNote(value) : value;
        return safeCell(mapped, dateFields.has(field.label));
      });
      const dataRow = worksheet.addRow(values);
      dataRow.font = { name: 'Inter', size: 10, color: { argb: 'FF26332D' } };
      sheet.fields.forEach((field, index) => {
        if (numericFields.has(field.label)) dataRow.getCell(index + 1).alignment = { horizontal: 'right' };
      });
      if (sheet.id === 'inventory-summary' && row[0] === 'SUMMARY') dataRow.font = { name: 'Inter', size: 10, bold: true, color: { argb: 'FF173D2B' } };
    }
  }
  return {
    buffer: await workbook.xlsx.writeBuffer(),
    dataRows: tables.map(table => table.dataRows),
    reports: selectedSheets.map((sheet, index) => ({ reportId: sheet.id, dataRows: tables[index].dataRows })),
  };
}
