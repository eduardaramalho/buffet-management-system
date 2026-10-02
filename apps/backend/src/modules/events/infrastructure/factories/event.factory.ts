import { AuditService } from "../../../../modules/auth/application/AuditService.js";
import { PrismaAuditRepository } from "../../../../modules/auth/infrastructure/repositories/PrismaAuditRepository.js";
import { prisma } from "../../../../shared/config/database.js";
import { logger } from "../../../../shared/config/logger.js";
import { EventManagementService } from "../../application/EventManagementService.js";
import { ServiceCatalogService } from "../../application/ServiceCatalogService.js";
import { EventController } from "../../presentation/controllers/EventController.js";
import { ServiceController } from "../../presentation/controllers/ServiceController.js";
import { PrismaEventRepository } from "../repositories/PrismaEventRepository.js";
import { PrismaServiceRepository } from "../repositories/PrismaServiceRepository.js";
import { ruleEngineExecutionService } from "../../../tasks/infrastructure/factories/task.factory.js";

const eventRepository = new PrismaEventRepository(prisma);
const serviceRepository = new PrismaServiceRepository(prisma);
const auditService = new AuditService(new PrismaAuditRepository(prisma));

export const eventService = new EventManagementService(eventRepository, auditService, serviceRepository, ruleEngineExecutionService, logger);
export const serviceCatalogService = new ServiceCatalogService(serviceRepository, auditService);
export const eventController = new EventController(eventService);
export const serviceController = new ServiceController(serviceCatalogService);