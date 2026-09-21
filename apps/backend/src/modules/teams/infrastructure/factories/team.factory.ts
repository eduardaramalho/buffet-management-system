import { AuditService } from "../../../auth/application/AuditService.js";
import { PrismaAuditRepository } from "../../../auth/infrastructure/repositories/PrismaAuditRepository.js";
import { prisma } from "../../../../shared/config/database.js";
import { EventTeamService } from "../../application/EventTeamService.js";
import { TeamService } from "../../application/TeamService.js";
import { EventTeamController } from "../../presentation/controllers/EventTeamController.js";
import { CollaboratorController } from "../../presentation/controllers/CollaboratorController.js";
import { TeamController } from "../../presentation/controllers/TeamController.js";
import { CollaboratorService } from "../../application/CollaboratorService.js";
import { PrismaEventTeamRepository } from "../repositories/PrismaEventTeamRepository.js";
import { PrismaCollaboratorRepository } from "../repositories/PrismaCollaboratorRepository.js";
import { PrismaTeamRepository } from "../repositories/PrismaTeamRepository.js";

const teamRepository = new PrismaTeamRepository(prisma);
const collaboratorRepository = new PrismaCollaboratorRepository(prisma);
const eventTeamRepository = new PrismaEventTeamRepository(prisma);
const auditService = new AuditService(new PrismaAuditRepository(prisma));

export const teamService = new TeamService(teamRepository, auditService, collaboratorRepository);
export const collaboratorService = new CollaboratorService(collaboratorRepository, auditService);
export const eventTeamService = new EventTeamService(eventTeamRepository, auditService);
export const teamController = new TeamController(teamService);
export const collaboratorController = new CollaboratorController(collaboratorService);
export const eventTeamController = new EventTeamController(eventTeamService);
