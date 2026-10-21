import { prisma } from "../../../../shared/config/database.js";
import { PrismaEventRepository } from "../../../events/infrastructure/repositories/PrismaEventRepository.js";
import { AuditHistoryService } from "../../application/AuditHistoryService.js";
import { AuditHistoryController } from "../../presentation/controllers/AuditHistoryController.js";
import { PrismaAuditRepository } from "../repositories/PrismaAuditRepository.js";

export const auditHistoryService = new AuditHistoryService(new PrismaEventRepository(prisma), new PrismaAuditRepository(prisma));
export const auditHistoryController = new AuditHistoryController(auditHistoryService);