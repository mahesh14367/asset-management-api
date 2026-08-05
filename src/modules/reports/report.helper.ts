import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// ---------------------------------------------------------------------------
// Public enums & interfaces (re-exported by report.service.ts)
// ---------------------------------------------------------------------------

export enum ReportType {
  ASSET_INVENTORY   = 'asset_inventory',
  ASSET_ASSIGNMENTS = 'asset_assignments',
  MAINTENANCE_LOG   = 'maintenance_log',
  EMPLOYEE_ASSETS   = 'employee_assets',
}

export enum ReportFormat {
  CSV  = 'csv',
  XLSX = 'xlsx',
  PDF  = 'pdf',
}

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  category?: string;
}

export interface GenerateReportParams extends ReportFilters {
  type: ReportType;
  format: ReportFormat;
}

// ---------------------------------------------------------------------------
// Internal types shared between helper and service
// ---------------------------------------------------------------------------

export interface ColumnDef {
  header: string;
  xlsxWidth: number; // character width for ExcelJS
  pdfWidth: number;  // point width for PDFKit (landscape A4 usable ~761pt)
  isNumber?: boolean;
}

export type Cell    = string | number | null;
export type DataRow = Cell[];

export interface ReportMeta {
  title: string;
  type: ReportType;
  generatedAt: Date;
  generatedBy: string;
  totalRecords: number;
  filtersDisplay: string;
}

// ---------------------------------------------------------------------------
// Column definitions per report type
// All pdfWidth values sum to ≤ 761 (usable landscape A4 width with 40pt margins)
// ---------------------------------------------------------------------------

export const COLUMNS: Record<ReportType, ColumnDef[]> = {
  [ReportType.ASSET_INVENTORY]: [
    { header: 'Asset Tag',       xlsxWidth: 14, pdfWidth: 68 },
    { header: 'Kind',            xlsxWidth: 14, pdfWidth: 65 },
    { header: 'Category',        xlsxWidth: 16, pdfWidth: 72 },
    { header: 'Name',            xlsxWidth: 24, pdfWidth: 105 },
    { header: 'Brand',           xlsxWidth: 14, pdfWidth: 62 },
    { header: 'Status',          xlsxWidth: 16, pdfWidth: 70 },
    { header: 'Location',        xlsxWidth: 18, pdfWidth: 75 },
    { header: 'Purchase Price',  xlsxWidth: 14, pdfWidth: 70, isNumber: true },
    { header: 'Warranty Expiry', xlsxWidth: 14, pdfWidth: 68 },
    { header: 'Condition',       xlsxWidth: 12, pdfWidth: 55 },
    // Total: 710pt
  ],
  [ReportType.ASSET_ASSIGNMENTS]: [
    { header: 'Asset Tag',       xlsxWidth: 14, pdfWidth: 68 },
    { header: 'Asset Name',      xlsxWidth: 22, pdfWidth: 100 },
    { header: 'Emp Code',        xlsxWidth: 14, pdfWidth: 70 },
    { header: 'Employee Name',   xlsxWidth: 22, pdfWidth: 102 },
    { header: 'Department',      xlsxWidth: 18, pdfWidth: 88 },
    { header: 'Assigned Date',   xlsxWidth: 14, pdfWidth: 72 },
    { header: 'Expected Return', xlsxWidth: 14, pdfWidth: 72 },
    { header: 'Status',          xlsxWidth: 12, pdfWidth: 65 },
    { header: 'Condition',       xlsxWidth: 14, pdfWidth: 68 },
    // Total: 705pt
  ],
  [ReportType.MAINTENANCE_LOG]: [
    { header: 'Asset Tag',       xlsxWidth: 14, pdfWidth: 68 },
    { header: 'Asset Name',      xlsxWidth: 22, pdfWidth: 100 },
    { header: 'Type',            xlsxWidth: 12, pdfWidth: 62 },
    { header: 'Status',          xlsxWidth: 12, pdfWidth: 62 },
    { header: 'Vendor',          xlsxWidth: 20, pdfWidth: 90 },
    { header: 'Cost',            xlsxWidth: 12, pdfWidth: 58, isNumber: true },
    { header: 'Started Date',    xlsxWidth: 14, pdfWidth: 68 },
    { header: 'Completed Date',  xlsxWidth: 14, pdfWidth: 72 },
    { header: 'Duration (days)', xlsxWidth: 14, pdfWidth: 65, isNumber: true },
    { header: 'Description',     xlsxWidth: 30, pdfWidth: 110 },
    // Total: 755pt
  ],
  [ReportType.EMPLOYEE_ASSETS]: [
    { header: 'Emp Code',        xlsxWidth: 14, pdfWidth: 70 },
    { header: 'Employee Name',   xlsxWidth: 22, pdfWidth: 100 },
    { header: 'Department',      xlsxWidth: 18, pdfWidth: 88 },
    { header: 'Asset Tag',       xlsxWidth: 14, pdfWidth: 65 },
    { header: 'Asset Name',      xlsxWidth: 22, pdfWidth: 100 },
    { header: 'Category',        xlsxWidth: 16, pdfWidth: 68 },
    { header: 'Kind',            xlsxWidth: 14, pdfWidth: 60 },
    { header: 'Assigned Date',   xlsxWidth: 14, pdfWidth: 70 },
    { header: 'Expected Return', xlsxWidth: 14, pdfWidth: 68 },
    { header: 'Status',          xlsxWidth: 12, pdfWidth: 62 },
    // Total: 751pt
  ],
};

export const REPORT_TITLES: Record<ReportType, string> = {
  [ReportType.ASSET_INVENTORY]:   'Asset Inventory Report',
  [ReportType.ASSET_ASSIGNMENTS]: 'Asset Assignments Report',
  [ReportType.MAINTENANCE_LOG]:   'Maintenance Log Report',
  [ReportType.EMPLOYEE_ASSETS]:   'Employee Assets Report',
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export const formatDate = (date?: Date | string | null): string =>
  date ? new Date(date).toISOString().slice(0, 10) : '';

export const formatDateTime = (date: Date): string =>
  new Date(date).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

export const calcDurationDays = (started: Date, completed?: Date | null): number =>
  Math.max(1, Math.ceil(
    ((completed ? new Date(completed) : new Date()).getTime() - new Date(started).getTime()) / 86400000
  ));

export const escapeCSVCell = (cell: Cell): string => {
  const str = cell == null ? '' : String(cell);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
};

export const buildFiltersDisplay = (f: ReportFilters): string => {
  const parts: string[] = [];
  if (f.status)    parts.push(`Status: ${f.status}`);
  if (f.category)  parts.push(`Category: ${f.category}`);
  if (f.startDate) parts.push(`From: ${formatDate(f.startDate)}`);
  if (f.endDate)   parts.push(`To: ${formatDate(f.endDate)}`);
  return parts.length > 0 ? parts.join('  |  ') : 'None';
};

export const buildFilename = (type: ReportType, format: ReportFormat): string =>
  `${type}_${new Date().toISOString().slice(0, 10)}.${format}`;

// Converts a 1-based column number to an Excel column letter (A … Z, AA, AB …)
export const colLetter = (n: number): string => {
  let letter = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
};

// ---------------------------------------------------------------------------
// CSV streamer
// ---------------------------------------------------------------------------

export const streamCSV = (columns: ColumnDef[], rows: DataRow[], meta: ReportMeta, res: Response): void => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${buildFilename(meta.type, ReportFormat.CSV)}"`);

  res.write(`# ${meta.title}\r\n`);
  res.write(`# Generated: ${formatDateTime(meta.generatedAt)} | By: ${meta.generatedBy} | Total Records: ${meta.totalRecords}\r\n`);
  res.write(`# Filters: ${meta.filtersDisplay}\r\n`);
  res.write(columns.map(c => escapeCSVCell(c.header)).join(',') + '\r\n');
  for (const row of rows) {
    res.write(row.map(escapeCSVCell).join(',') + '\r\n');
  }
  res.end();
};

// ---------------------------------------------------------------------------
// XLSX streamer
// Uses writeBuffer() instead of write(stream) to avoid stream-end timing issues
// ---------------------------------------------------------------------------

const XLSX_HEADER_BG     = 'FF1E3A5F'; // dark navy  — title row
const XLSX_COL_HEADER_BG = 'FF1E3A8A'; // medium blue — column header row
const XLSX_META_BG       = 'FFF3F4F6'; // light gray  — meta rows
const XLSX_ROW_ALT_BG    = 'FFF9FAFB'; // off-white   — alternating data rows

export const streamXLSX = async (columns: ColumnDef[], rows: DataRow[], meta: ReportMeta, res: Response): Promise<void> => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${buildFilename(meta.type, ReportFormat.XLSX)}"`);

  const wb = new ExcelJS.Workbook();
  wb.creator  = meta.generatedBy;
  wb.created  = meta.generatedAt;

  const ws = wb.addWorksheet(meta.title, {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }], // freeze column header row
  });

  const lastCol = colLetter(columns.length);

  // Row 1 — report title
  ws.mergeCells(`A1:${lastCol}1`);
  const titleCell = ws.getCell('A1');
  titleCell.value     = `ASSET MANAGEMENT SYSTEM  —  ${meta.title}`;
  titleCell.font      = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_HEADER_BG } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // Row 2 — generated by + date
  ws.mergeCells(`A2:${lastCol}2`);
  const r2        = ws.getCell('A2');
  r2.value        = `Generated: ${formatDateTime(meta.generatedAt)}   |   By: ${meta.generatedBy}   |   Total Records: ${meta.totalRecords}`;
  r2.font         = { size: 9, color: { argb: 'FF374151' } };
  r2.fill         = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_META_BG } };
  r2.alignment    = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.getRow(2).height = 18;

  // Row 3 — filters
  ws.mergeCells(`A3:${lastCol}3`);
  const r3        = ws.getCell('A3');
  r3.value        = `Filters Applied: ${meta.filtersDisplay}`;
  r3.font         = { size: 9, italic: true, color: { argb: 'FF6B7280' } };
  r3.fill         = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_META_BG } };
  r3.alignment    = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.getRow(3).height = 18;

  // Row 4 — spacer
  ws.getRow(4).height = 6;

  // Row 5 — frozen column headers
  const headerRow = ws.getRow(5);
  headerRow.height = 22;
  columns.forEach((col, i) => {
    const cell      = headerRow.getCell(i + 1);
    cell.value      = col.header;
    cell.font       = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_COL_HEADER_BG } };
    cell.alignment  = { horizontal: 'center', vertical: 'middle' };
    cell.border     = { bottom: { style: 'thin', color: { argb: 'FF93C5FD' } } };
  });

  columns.forEach((col, i) => { ws.getColumn(i + 1).width = col.xlsxWidth; });

  // Rows 6+ — data
  rows.forEach((row, rowIdx) => {
    const wsRow   = ws.addRow(row);
    wsRow.height  = 16;
    const bgArgb  = rowIdx % 2 === 0 ? XLSX_ROW_ALT_BG : 'FFFFFFFF';

    wsRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      cell.font      = { size: 9, color: { argb: 'FF1F2937' } };
      cell.border    = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
      const def      = columns[colNum - 1];
      if (def?.isNumber) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt    = '#,##0.00';
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  res.end(buffer);
};

// ---------------------------------------------------------------------------
// PDF streamer — landscape A4, enterprise header, auto page-break with
// repeated column headers and page-number footer on every page
// ---------------------------------------------------------------------------

const PDF_HEADER_H = 22; // table column-header row height in points
const PDF_ROW_H    = 18; // data row height in points

export const streamPDF = (columns: ColumnDef[], rows: DataRow[], meta: ReportMeta, res: Response): void => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${buildFilename(meta.type, ReportFormat.PDF)}"`);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
  });
  doc.pipe(res);

  const PW         = doc.page.width;
  const ML         = doc.page.margins.left;
  const MT         = doc.page.margins.top;
  const PH         = doc.page.height;
  const MB         = doc.page.margins.bottom;
  const BOTTOM_STOP = PH - MB - 20;
  const TABLE_W    = columns.reduce((s, c) => s + c.pdfWidth, 0);

  let pageNum = 1;

  const drawFooter = (atY: number) => {
    doc.font('Helvetica').fontSize(7).fillColor('#9CA3AF')
       .text(
         `Page ${pageNum}  —  Generated ${formatDateTime(meta.generatedAt)}`,
         ML, atY,
         { width: TABLE_W, align: 'right', lineBreak: false }
       );
  };

  const drawTableHeader = (startY: number): number => {
    doc.save();
    doc.rect(ML, startY, TABLE_W, PDF_HEADER_H).fillColor('#1E3A5F').fill();
    let x = ML;
    columns.forEach(col => {
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF')
         .text(col.header, x + 3, startY + 7, { width: col.pdfWidth - 6, lineBreak: false });
      x += col.pdfWidth;
    });
    doc.restore();
    return startY + PDF_HEADER_H;
  };

  // ---- Cover header ----
  let y = MT;

  doc.font('Helvetica').fontSize(7.5).fillColor('#9CA3AF')
     .text('ASSET MANAGEMENT SYSTEM', ML, y, { lineBreak: false });
  y += 16;

  doc.font('Helvetica-Bold').fontSize(17).fillColor('#1E3A5F')
     .text(meta.title, ML, y, { lineBreak: false });
  y += 26;

  doc.moveTo(ML, y).lineTo(PW - ML, y).strokeColor('#D1D5DB').lineWidth(0.5).stroke();
  y += 9;

  doc.font('Helvetica').fontSize(7.5).fillColor('#4B5563')
     .text(`Generated: ${formatDateTime(meta.generatedAt)}`, ML, y, { lineBreak: false })
     .text(`Total Records: ${meta.totalRecords}`, PW - ML - 130, y, { lineBreak: false });
  y += 13;

  doc.font('Helvetica').fontSize(7.5).fillColor('#4B5563')
     .text(`Generated By: ${meta.generatedBy}`, ML, y, { lineBreak: false });
  y += 13;

  doc.font('Helvetica').fontSize(7.5).fillColor('#6B7280')
     .text(`Filters: ${meta.filtersDisplay}`, ML, y, { lineBreak: false });
  y += 18;

  doc.moveTo(ML, y).lineTo(PW - ML, y).strokeColor('#D1D5DB').lineWidth(0.5).stroke();
  y += 10;

  // ---- Table ----
  y = drawTableHeader(y);

  rows.forEach((row, rowIdx) => {
    if (y + PDF_ROW_H > BOTTOM_STOP) {
      drawFooter(PH - MB - 12);
      doc.addPage();
      pageNum++;
      y = MT;
      y = drawTableHeader(y);
    }

    doc.save();
    doc.rect(ML, y, TABLE_W, PDF_ROW_H)
       .fillColor(rowIdx % 2 === 0 ? '#F9FAFB' : '#FFFFFF')
       .fill();
    doc.restore();

    let x = ML;
    row.forEach((cell, i) => {
      doc.font('Helvetica').fontSize(6.5).fillColor('#1F2937')
         .text(cell == null ? '' : String(cell), x + 3, y + 5, { width: columns[i]!.pdfWidth - 6, lineBreak: false });
      x += columns[i]!.pdfWidth;
    });

    doc.moveTo(ML, y + PDF_ROW_H)
       .lineTo(ML + TABLE_W, y + PDF_ROW_H)
       .strokeColor('#E5E7EB').lineWidth(0.3).stroke();

    y += PDF_ROW_H;
  });

  if (rows.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor('#9CA3AF')
       .text('No records found for the selected filters.', ML, y + 10, { lineBreak: false });
  }

  drawFooter(PH - MB - 12);
  doc.end();
};
