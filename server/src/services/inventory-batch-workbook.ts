import type { InventoryBatchPageQuery } from '../validators/inventory-batch';
import type { InventoryBatch, InventoryBatchService } from './inventory-batches';
import { AdministrationError } from '../middleware/administration.middleware';

const MAX_EXPORT_ROWS = 5_000;
const PAGE_SIZE = 150;

const dateOnly = (value: string) => value.slice(0, 10);
const safeCell = (value: string) => /^[\s\u0000-\u001f]*[=+\-@]/u.test(value) ? `'${value}` : value;
const preparedAt = (value: Date) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).format(value);

export async function inventoryBatchWorkbook(service: InventoryBatchService, query: InventoryBatchPageQuery, now = new Date()) {
  const items: InventoryBatch[] = [];
  let page = 1, total = 0;
  do {
    const result = await service.list({ ...query, page, pageSize: PAGE_SIZE });
    total = result.total;
    if (total > MAX_EXPORT_ROWS) throw new AdministrationError(413, 'EXPORT_TOO_LARGE', 'Narrow the report to at most 5,000 data rows');
    items.push(...result.items);
    page += 1;
  } while (items.length < total);

  const { Workbook } = (await import('@excel.js/exceljs')).default;
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Inventory Period');
  worksheet.addRow(['Inventory Period Report']).font = { name: 'Inter', size: 14, bold: true, color: { argb: 'FF173D2B' } };
  worksheet.addRow(['Report Prepared At (Philippine Time)', preparedAt(now)]).font = { name: 'Inter', size: 9, color: { argb: 'FF667C6C' } };
  worksheet.addRow([]);
  const headers = ['Ingredient', 'Batch ID', 'Quantity', 'Unit', 'Date Received', 'Expiration Date', 'Status'];
  const header = worksheet.addRow(headers);
  header.font = { name: 'Inter', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF11613C' } };
  header.alignment = { vertical: 'middle' };
  worksheet.views = [{ state: 'frozen', ySplit: 4 }];
  [28, 22, 14, 12, 16, 16, 16].forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });
  worksheet.getColumn(3).numFmt = '#,##0.00';
  worksheet.getColumn(5).numFmt = 'yyyy-mm-dd';
  worksheet.getColumn(6).numFmt = 'yyyy-mm-dd';
  for (const batch of items) {
    const row = worksheet.addRow([
      safeCell(batch.ingredient.name), safeCell(batch.batchID), batch.quantity, safeCell(batch.unit),
      new Date(`${dateOnly(batch.dateReceived)}T00:00:00.000Z`), new Date(`${dateOnly(batch.expirationDate)}T00:00:00.000Z`), batch.displayStatus,
    ]);
    row.font = { name: 'Inter', size: 10, color: { argb: 'FF26332D' } };
    row.getCell(3).alignment = { horizontal: 'right' };
  }
  return { buffer: await workbook.xlsx.writeBuffer(), dataRows: items.length };
}
