import { describe, expect, it } from "@jest/globals";

import { CsvReportExporter } from "./CsvReportExporter.js";
import type { ReportDocument } from "../../domain/report.types.js";

const document = (rows: ReportDocument["rows"], columns = ["Evento", "Convidados"]): ReportDocument => ({
  title: "Relatório de eventos",
  periodLabel: "01/10/2026 a 31/10/2026",
  generatedAtLabel: "21/10/2026 12:00",
  summary: [{ label: "Total", value: rows.length }],
  columns,
  rows,
});

const render = async (doc: ReportDocument) => (await new CsvReportExporter().render(doc)).toString("utf8");

describe("CsvReportExporter", () => {
  it("declares CSV content type and extension", () => {
    const exporter = new CsvReportExporter();

    expect(exporter.contentType).toBe("text/csv; charset=utf-8");
    expect(exporter.extension).toBe("csv");
  });

  it("writes a UTF-8 BOM, a header row and one line per row using semicolons and CRLF (Excel pt-BR)", async () => {
    const csv = await render(document([["Casamento Ana", 120], ["Formatura", 80]]));

    expect(csv).toBe("﻿Evento;Convidados\r\nCasamento Ana;120\r\nFormatura;80\r\n");
  });

  it("renders null as an empty cell", async () => {
    const csv = await render(document([["Casamento", null]]));

    expect(csv).toBe("﻿Evento;Convidados\r\nCasamento;\r\n");
  });

  it("quotes cells with separators, quotes or line breaks and doubles inner quotes", async () => {
    const csv = await render(document([['Festa "VIP"; salão 2', "linha 1\nlinha 2"]]));

    expect(csv).toBe('﻿Evento;Convidados\r\n"Festa ""VIP""; salão 2";"linha 1\nlinha 2"\r\n');
  });

  it.each(["=HYPERLINK(\"http://x\")", "+55 47", "-1", "@SUM(A1)", "\tcmd", "\rcmd"])(
    "neutralizes spreadsheet formula injection in text cell %j",
    async (value) => {
      const csv = await render(document([[value, 1]]));

      const firstCell = csv.split("\r\n")[1];
      expect(firstCell.replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  it("does not alter numeric cells, including negative numbers", async () => {
    const csv = await render(document([["Saldo", -1]]));

    expect(csv).toBe("﻿Evento;Convidados\r\nSaldo;-1\r\n");
  });
});
