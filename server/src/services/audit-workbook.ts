import type { AuditRecord } from './administration';
import { presentAuditDetails } from './audit-presentation';

const safeCell = (value: string) => /^[\s\u0000-\u001f]*[=+\-@]/u.test(value) ? `'${value}` : value;
const preparedAt = (value: Date) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).format(value);
// Excel renders a date serial as naive wall-clock time built from its UTC
// components (exceljs writes UTC-based serials), so the instant is shifted by
// the fixed Philippine offset — Asia/Manila is UTC+8 year-round, no DST — for
// the Date & Time column to display Philippine time like the prepared-at
// header and every other report surface.
const manilaWallClock = (value: Date) => new Date(value.getTime() + 8 * 3600000);

export async function auditWorkbook(records: AuditRecord[], now = new Date()) {
  const { Workbook } = (await import('@excel.js/exceljs')).default;
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Audit Records');
  worksheet.addRow(['Audit Records']).font = { name: 'Inter', size: 14, bold: true, color: { argb: 'FF173D2B' } };
  worksheet.addRow(['Report Prepared At (Philippine Time)', preparedAt(now)]).font = { name: 'Inter', size: 9, color: { argb: 'FF667C6C' } };
  worksheet.addRow([]);
  // The column set mirrors the approved Audit Logs table exactly (row ordinal,
  // date, user, action, module, details, status); the workbook omits the
  // frontend's '#' because Excel numbers rows itself, and Role/Target are not
  // approved frontend columns.
  const headers = ['Date & Time', 'User', 'Action', 'Module', 'Details', 'Status'];
  const header = worksheet.addRow(headers);
  header.font = { name: 'Inter', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF11613C' } };
  header.alignment = { vertical: 'middle' };
  worksheet.views = [{ state: 'frozen', ySplit: 4 }];
  [22, 26, 16, 24, 44, 14].forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });
  worksheet.getColumn(1).numFmt = 'yyyy-mm-dd hh:mm:ss';
  for (const record of records) {
    const timestamp = new Date(record.timestamp);
    const row = worksheet.addRow([
      Number.isNaN(timestamp.valueOf()) ? safeCell(record.timestamp) : manilaWallClock(timestamp),
      safeCell(record.actor.name.trim() || 'Unknown account'), record.action,
      safeCell(record.module ?? record.targetType), safeCell(presentAuditDetails(record)), record.status ?? 'Success',
    ]);
    row.font = { name: 'Inter', size: 10, color: { argb: 'FF26332D' } };
  }
  return workbook.xlsx.writeBuffer();
}
