import { AuditService } from "../../../auth/application/AuditService.js";
import { PrismaAuditRepository } from "../../../auth/infrastructure/repositories/PrismaAuditRepository.js";
import { prisma } from "../../../../shared/config/database.js";
import { ReportService } from "../../application/ReportService.js";
import { ReportController } from "../../presentation/controllers/ReportController.js";
import { CsvReportExporter } from "../exporters/CsvReportExporter.js";
import { PdfReportExporter } from "../exporters/PdfReportExporter.js";
import { PrismaReportRepository } from "../repositories/PrismaReportRepository.js";

const auditService = new AuditService(new PrismaAuditRepository(prisma));

export const reportService = new ReportService(
  new PrismaReportRepository(prisma),
  { csv: new CsvReportExporter(), pdf: new PdfReportExporter() },
  auditService,
);
export const reportController = new ReportController(reportService);
