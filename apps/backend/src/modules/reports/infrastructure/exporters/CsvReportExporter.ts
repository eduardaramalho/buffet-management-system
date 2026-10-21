import type { ReportCell, ReportDocument, ReportExporter } from "../../domain/report.types.js";

const SEPARATOR = ";";
const LINE_BREAK = "\r\n";
const BOM = "﻿";
// Cells starting with these characters are interpreted as formulas by spreadsheet apps (CSV injection, OWASP).
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[;"\r\n]/;

/**
 * RFC 4180 style CSV tuned for Excel in pt-BR: semicolon separator (comma is the decimal separator),
 * CRLF line endings and a UTF-8 BOM so accents open correctly. Only the tabular data is written; the
 * period is part of the file name.
 */
export class CsvReportExporter implements ReportExporter {
  readonly contentType = "text/csv; charset=utf-8";
  readonly extension = "csv";

  async render(document: ReportDocument): Promise<Buffer> {
    const lines = [document.columns, ...document.rows].map((row) => row.map(formatCell).join(SEPARATOR));
    return Buffer.from(BOM + lines.join(LINE_BREAK) + LINE_BREAK, "utf8");
  }
}

function formatCell(cell: ReportCell): string {
  if (cell === null) return "";
  if (typeof cell === "number") return String(cell);
  const safe = FORMULA_PREFIX.test(cell) ? `'${cell}` : cell;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
