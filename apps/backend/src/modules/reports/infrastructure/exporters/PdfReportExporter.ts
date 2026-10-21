import PDFDocument from "pdfkit";

import type { ReportCell, ReportDocument, ReportExporter } from "../../domain/report.types.js";

type PdfDoc = InstanceType<typeof PDFDocument>;

// Same tokens as the frontend (index.css): --navy-900, --gold-500, --ink-900, --slate-600, --content-bg, --line-200.
const COLORS = { primary: "#102650", accent: "#E5A72D", text: "#14213D", muted: "#5D6B84", zebra: "#F7F9FC", border: "#DCE2EB" };
const MARGIN = 36;
const FOOTER_HEIGHT = 20;
const CELL_PADDING = 4;
const TABLE_FONT_SIZE = 8;
const MIN_COLUMN_WEIGHT = 6;
const MAX_COLUMN_WEIGHT = 40;

type Options = { compress?: boolean };

/**
 * Renders a ReportDocument as an A4 landscape PDF with PDFKit (pure JavaScript, no headless browser).
 * Layout: title and period, summary grid, then a table that wraps long text, breaks across pages
 * repeating its header, and numbers every page ("x de y").
 */
export class PdfReportExporter implements ReportExporter {
  readonly contentType = "application/pdf";
  readonly extension = "pdf";

  constructor(private readonly options: Options = {}) {}

  render(document: ReportDocument): Promise<Buffer> {
    const pdf = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: MARGIN,
      bufferPages: true,
      compress: this.options.compress ?? true,
      info: { Title: document.title, Author: "EventosPro", Creator: "EventosPro" },
    });

    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.on("error", reject);
    });

    writeHeader(pdf, document);
    writeSummary(pdf, document.summary);
    writeTable(pdf, document);
    writePageNumbers(pdf);
    pdf.end();
    return done;
  }
}

const contentWidth = (pdf: PdfDoc) => pdf.page.width - MARGIN * 2;
const contentBottom = (pdf: PdfDoc) => pdf.page.height - MARGIN - FOOTER_HEIGHT;
const cellText = (cell: ReportCell) => (cell === null ? "-" : String(cell));

function writeHeader(pdf: PdfDoc, document: ReportDocument) {
  pdf.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(16).text(document.title, MARGIN, MARGIN);
  pdf.moveDown(0.2);
  pdf.fillColor(COLORS.muted).font("Helvetica").fontSize(9)
    .text(`Período: ${document.periodLabel}    Gerado em: ${document.generatedAtLabel}`);
  const lineY = pdf.y + 6;
  pdf.moveTo(MARGIN, lineY).lineTo(MARGIN + contentWidth(pdf), lineY).lineWidth(1.5).strokeColor(COLORS.accent).stroke();
  pdf.y = lineY + 10;
}

function writeSummary(pdf: PdfDoc, summary: ReportDocument["summary"]) {
  if (summary.length === 0) return;
  const perRow = 4;
  const cellWidth = contentWidth(pdf) / perRow;
  const lineHeight = 14;
  const startY = pdf.y;
  pdf.fontSize(9);
  summary.forEach((item, index) => {
    const x = MARGIN + (index % perRow) * cellWidth;
    const y = startY + Math.floor(index / perRow) * lineHeight;
    pdf.font("Helvetica").fillColor(COLORS.muted).text(`${item.label}: `, x, y, { continued: true, lineBreak: false });
    pdf.font("Helvetica-Bold").fillColor(COLORS.text).text(cellText(item.value), { lineBreak: false });
  });
  pdf.x = MARGIN;
  pdf.y = startY + Math.ceil(summary.length / perRow) * lineHeight + 6;
}

/**
 * Column widths proportional to the longest text of each column, clamped so no column dominates, but
 * never narrower than the longest single word (wrapping happens between words, never inside one).
 */
function columnWidths(pdf: PdfDoc, document: ReportDocument): number[] {
  const weights = document.columns.map((header, column) => {
    const texts = [header, ...document.rows.map((row) => cellText(row[column]))];
    const longest = Math.max(...texts.map((text) => text.length));
    const longestWord = Math.max(...texts.flatMap((text) => text.split(/\s+/).map((word) => word.length)));
    return Math.max(Math.min(MAX_COLUMN_WEIGHT, Math.max(MIN_COLUMN_WEIGHT, longest)), longestWord + 2);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => (contentWidth(pdf) * weight) / total);
}

function rowHeight(pdf: PdfDoc, cells: string[], widths: number[]): number {
  const heights = cells.map((text, index) => pdf.heightOfString(text, { width: widths[index] - CELL_PADDING * 2 }));
  return Math.max(...heights) + CELL_PADDING * 2;
}

function drawRow(pdf: PdfDoc, cells: string[], widths: number[], y: number, height: number, style: { fill?: string; color: string; bold: boolean }) {
  if (style.fill) pdf.rect(MARGIN, y, contentWidth(pdf), height).fill(style.fill);
  pdf.font(style.bold ? "Helvetica-Bold" : "Helvetica").fontSize(TABLE_FONT_SIZE).fillColor(style.color);
  let x = MARGIN;
  cells.forEach((text, index) => {
    pdf.text(text, x + CELL_PADDING, y + CELL_PADDING, { width: widths[index] - CELL_PADDING * 2 });
    x += widths[index];
  });
  pdf.moveTo(MARGIN, y + height).lineTo(MARGIN + contentWidth(pdf), y + height).lineWidth(0.5).strokeColor(COLORS.border).stroke();
}

function writeTable(pdf: PdfDoc, document: ReportDocument) {
  if (document.rows.length === 0) {
    pdf.font("Helvetica-Oblique").fontSize(10).fillColor(COLORS.muted).text("Nenhum registro no período selecionado.", MARGIN, pdf.y + 8);
    return;
  }

  const widths = columnWidths(pdf, document);
  pdf.font("Helvetica-Bold").fontSize(TABLE_FONT_SIZE);
  const headerHeight = rowHeight(pdf, document.columns, widths);
  const drawHeader = (y: number) => drawRow(pdf, document.columns, widths, y, headerHeight, { fill: COLORS.primary, color: "#FFFFFF", bold: true });

  let y = pdf.y + 4;
  drawHeader(y);
  y += headerHeight;

  document.rows.forEach((row, index) => {
    const cells = row.map(cellText);
    pdf.font("Helvetica").fontSize(TABLE_FONT_SIZE);
    const height = rowHeight(pdf, cells, widths);
    if (y + height > contentBottom(pdf)) {
      pdf.addPage();
      y = MARGIN;
      drawHeader(y);
      y += headerHeight;
    }
    drawRow(pdf, cells, widths, y, height, { fill: index % 2 === 1 ? COLORS.zebra : undefined, color: COLORS.text, bold: false });
    y += height;
  });
}

function writePageNumbers(pdf: PdfDoc) {
  const range = pdf.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    pdf.switchToPage(index);
    const y = pdf.page.height - MARGIN - 10;
    // Writing below the bottom margin must not trigger an automatic page break.
    const bottomMargin = pdf.page.margins.bottom;
    pdf.page.margins.bottom = 0;
    pdf.font("Helvetica").fontSize(8).fillColor(COLORS.muted)
      .text("EventosPro", MARGIN, y, { lineBreak: false })
      .text(`${index + 1} de ${range.count}`, MARGIN, y, { width: contentWidth(pdf), align: "right", lineBreak: false });
    pdf.page.margins.bottom = bottomMargin;
  }
}
