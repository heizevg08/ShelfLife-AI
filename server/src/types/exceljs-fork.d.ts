declare module '@excel.js/exceljs' {
  type Color = { argb: string };
  type Font = { name?: string; size?: number; bold?: boolean; color?: Color };
  type Fill = { type: 'pattern'; pattern: 'solid'; fgColor: Color };
  type Alignment = { horizontal?: 'left' | 'center' | 'right'; vertical?: 'top' | 'middle' | 'bottom' };
  type Cell = { alignment: Alignment };
  type Row = { font: Font; fill: Fill; alignment: Alignment; getCell(index: number): Cell };
  type Column = { numFmt: string; width: number };
  type Worksheet = {
    addRow(values: Array<string | number | Date | null>): Row;
    getRow(index: number): Row;
    getColumn(index: number): Column;
    views: Array<{ state: string; ySplit: number }>;
  };
  class Workbook {
    addWorksheet(name: string): Worksheet;
    xlsx: { writeBuffer(): Promise<Buffer> };
  }
  const excel: { Workbook: typeof Workbook };
  export default excel;
}
