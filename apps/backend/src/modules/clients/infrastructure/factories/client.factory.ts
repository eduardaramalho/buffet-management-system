import { AuditService } from "../../../auth/application/AuditService.js";
import { PrismaAuditRepository } from "../../../auth/infrastructure/repositories/PrismaAuditRepository.js";
import { prisma } from "../../../../shared/config/database.js";
import { ClientService } from "../../application/ClientService.js";
import { ClientController } from "../../presentation/controllers/ClientController.js";
import { PrismaClientRepository } from "../repositories/PrismaClientRepository.js";

// Exported so the events module can validate the event's client through its EventClientReader port.
export const clientRepository = new PrismaClientRepository(prisma);
const auditService = new AuditService(new PrismaAuditRepository(prisma));

export const clientService = new ClientService(clientRepository, auditService);
export const clientController = new ClientController(clientService);
