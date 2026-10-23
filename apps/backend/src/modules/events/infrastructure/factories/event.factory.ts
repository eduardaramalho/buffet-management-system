import { AuditService } from "../../../../modules/auth/application/AuditService.js";
import { PrismaAuditRepository } from "../../../../modules/auth/infrastructure/repositories/PrismaAuditRepository.js";
import { prisma } from "../../../../shared/config/database.js";
import { logger } from "../../../../shared/config/logger.js";
import { PrismaTransactionRunner } from "../../../../shared/infrastructure/PrismaTransactionRunner.js";
import { EventManagementService } from "../../application/EventManagementService.js";
import { EventReplicationService } from "../../application/EventReplicationService.js";
import { ServiceCatalogService } from "../../application/ServiceCatalogService.js";
import { EventController } from "../../presentation/controllers/EventController.js";
import { EventReplicationController } from "../../presentation/controllers/EventReplicationController.js";
import { ServiceController } from "../../presentation/controllers/ServiceController.js";
import { PrismaEventRepository } from "../repositories/PrismaEventRepository.js";
import { createReplicationTaskStore, createReplicationTeamGateway } from "../adapters/replicationGateways.js";
import { PrismaServiceRepository } from "../repositories/PrismaServiceRepository.js";
import { ruleEngineExecutionService } from "../../../tasks/infrastructure/factories/task.factory.js";
import { clientRepository } from "../../../clients/infrastructure/factories/client.factory.js";
import { PrismaTaskRepository } from "../../../tasks/infrastructure/repositories/PrismaTaskRepository.js";
import { PrismaTeamRepository } from "../../../teams/infrastructure/repositories/PrismaTeamRepository.js";
import { PrismaEventTeamRepository } from "../../../teams/infrastructure/repositories/PrismaEventTeamRepository.js";
import { EventTeamService } from "../../../teams/application/EventTeamService.js";

const eventRepository = new PrismaEventRepository(prisma);
const serviceRepository = new PrismaServiceRepository(prisma);
const auditService = new AuditService(new PrismaAuditRepository(prisma));

export const eventService = new EventManagementService(eventRepository, auditService, serviceRepository, ruleEngineExecutionService, logger, clientRepository);
export const serviceCatalogService = new ServiceCatalogService(serviceRepository, auditService);
export const eventController = new EventController(eventService);
export const serviceController = new ServiceController(serviceCatalogService);

// RF25 composition root: the replication service only knows its ports (eventReplication.types.ts);
// the adapters bind them to the public classes of the Tasks and Teams modules, the same reuse
// pattern used by task.factory.ts.
const taskRepository = new PrismaTaskRepository(prisma);
const teamRepository = new PrismaTeamRepository(prisma);
const eventTeamRepository = new PrismaEventTeamRepository(prisma);
const eventTeamService = new EventTeamService(eventTeamRepository, auditService);

export const eventReplicationService = new EventReplicationService({
  events: eventRepository,
  creationPolicy: eventService,
  catalog: serviceRepository,
  tasks: createReplicationTaskStore(taskRepository),
  teams: createReplicationTeamGateway({ teams: teamRepository, eventTeams: eventTeamService, assignments: eventTeamRepository }),
  transactions: new PrismaTransactionRunner(prisma),
  audit: auditService,
});
export const eventReplicationController = new EventReplicationController(eventReplicationService);