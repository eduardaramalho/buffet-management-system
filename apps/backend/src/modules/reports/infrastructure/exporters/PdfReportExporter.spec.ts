import { describe, expect, it } from "@jest/globals";

import { PdfReportExporter } from "./PdfReportExporter.js";
import type { ReportDocument } from "../../domain/report.types.js";

// Uncompressed output lets the test read the content streams. PDFKit writes each text run as a TJ array
// of hex-encoded WinAnsi chunks split at kerning pairs, e.g. [<436f6e> 40 <76696461646f73> 0] TJ.
function textRuns(pdf: string): string[] {
  return [...pdf.matchAll(/\[(.*?)\] TJ/g)].map(([, body]) =>
    [...body.matchAll(/<([0-9a-f]*)>/g)].map(([, chunk]) => Buffer.from(chunk, "hex").toString("latin1")).join(""));
}
const pageCount = (pdf: string) => pdf.match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;

const document = (rows: ReportDocument["rows"]): ReportDocument => ({
  title: "Relatorio de eventos",
  periodLabel: "01/10/2026 a 31/10/2026",
  generatedAtLabel: "21/10/2026 12:00",
  summary: [{ label: "Total de eventos", value: rows.length }, { label: "Pontualidade", value: "75%" }],
  columns: ["Data", "Evento", "Cliente", "Convidados"],
  rows,
});

const render = async (doc: ReportDocument) => (await new PdfReportExporter({ compress: false }).render(doc)).toString("latin1");

describe("PdfReportExporter", () => {
  it("declares PDF content type and extension", () => {
    const exporter = new PdfReportExporter();

    expect(exporter.contentType).toBe("application/pdf");
    expect(exporter.extension).toBe("pdf");
  });

  it("renders a valid PDF with title, period, summary, header and cells", async () => {
    const pdf = await render(document([["10/10/2026 19:00", "Casamento Ana", null, 120]]));

    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const runs = textRuns(pdf);
    expect(runs).toEqual(expect.arrayContaining(["Relatorio de eventos", "Total de eventos: ", "75%", "Convidados", "Casamento Ana", "120", "-"]));
    expect(runs.join(" ")).toContain("Período: 01/10/2026 a 31/10/2026");
  });

  it("produces a compressed document by default", async () => {
    const buffer = await new PdfReportExporter().render(document([["10/10/2026 19:00", "Casamento Ana", null, 120]]));

    expect(buffer.toString("latin1")).toContain("/FlateDecode");
  });

  it("paginates long reports, repeating the table header and numbering every page", async () => {
    const rows = Array.from({ length: 120 }, (_, index) => ["10/10/2026 19:00", `Evento ${index}`, "Cliente", index]);

    const pdf = await render(document(rows));

    const pages = pageCount(pdf);
    const runs = textRuns(pdf);
    expect(pages).toBeGreaterThan(1);
    expect(runs.filter((run) => run === "Convidados")).toHaveLength(pages);
    expect(runs).toContain(`1 de ${pages}`);
    expect(runs).toContain(`${pages} de ${pages}`);
    expect(runs).toContain("Evento 119");
  });

  it("writes an explicit message when the period has no rows", async () => {
    const pdf = await render(document([]));

    expect(textRuns(pdf)).toContain("Nenhum registro no período selecionado.");
    expect(pageCount(pdf)).toBe(1);
  });

  it("wraps long cell text instead of cutting it", async () => {
    const longName = "Casamento com nome muito longo ".repeat(6).trim();

    const pdf = await render(document([["10/10/2026 19:00", longName, "Cliente", 1]]));

    const runs = textRuns(pdf);
    expect(runs).not.toContain(longName);
    expect(runs.filter((run) => longName.includes(run.trim()) && run.trim().length > 0).length).toBeGreaterThan(1);
  });
});
