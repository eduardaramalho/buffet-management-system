import { AuditService } from "../../../auth/application/AuditService.js";
import { PrismaAuditRepository } from "../../../auth/infrastructure/repositories/PrismaAuditRepository.js";
import { prisma } from "../../../../shared/config/database.js";
import { PrismaTransactionRunner } from "../../../../shared/infrastructure/PrismaTransactionRunner.js";
import { PrismaEventRepository } from "../../../events/infrastructure/repositories/PrismaEventRepository.js";
import { PrismaTeamRepository } from "../../../teams/infrastructure/repositories/PrismaTeamRepository.js";
import { PrismaEventTeamRepository } from "../../../teams/infrastructure/repositories/PrismaEventTeamRepository.js";
import { EventTeamService } from "../../../teams/application/EventTeamService.js";
import { ruleEngineService } from "../../../rules/infrastructure/factories/rule.factory.js";
import { RuleEngineExecutionService } from "../../application/RuleEngineExecutionService.js";
import { TaskService } from "../../application/TaskService.js";
import { TaskController } from "../../presentation/controllers/TaskController.js";
import { RuleApplicationController } from "../../presentation/controllers/RuleApplicationController.js";
import { PrismaTaskRepository } from "../repositories/PrismaTaskRepository.js";
import { PrismaRuleApplicationRepository } from "../repositories/PrismaRuleApplicationRepository.js";
import { PrismaRuleTaskTemplateRepository } from "../repositories/PrismaRuleTaskTemplateRepository.js";

const taskRepository = new PrismaTaskRepository(prisma);
const ruleApplicationRepository = new PrismaRuleApplicationRepository(prisma);
const ruleTaskTemplateRepository = new PrismaRuleTaskTemplateRepository(prisma);
const auditService = new AuditService(new PrismaAuditRepository(prisma));
// Read-only reuse of the Events/Teams repositories and of Rules' own RuleEngineService instance
// to execute rules — mirrors the pattern already used by RuleEvaluationController (rule.factory.ts):
// no files in those modules are modified, only their existing public classes are instantiated/reused.
const eventReader = new PrismaEventRepository(prisma);
const teamRepository = new PrismaTeamRepository(prisma);
const eventTeamService = new EventTeamService(new PrismaEventTeamRepository(prisma), auditService);
const transactionRunner = new PrismaTransactionRunner(prisma);

export const taskService = new TaskService(taskRepository, auditService);
export const ruleEngineExecutionService = new RuleEngineExecutionService(
  ruleEngineService,
  eventReader,
  teamRepository,
  eventTeamService,
  taskRepository,
  ruleApplicationRepository,
  ruleTaskTemplateRepository,
  auditService,
  transactionRunner,
);
export const taskController = new TaskController(taskService);
export const ruleApplicationController = new RuleApplicationController(ruleEngineExecutionService);
