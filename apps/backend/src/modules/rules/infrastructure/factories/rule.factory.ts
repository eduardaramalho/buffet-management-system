import { AuditService } from "../../../auth/application/AuditService.js";
import { PrismaAuditRepository } from "../../../auth/infrastructure/repositories/PrismaAuditRepository.js";
import { PrismaEventRepository } from "../../../events/infrastructure/repositories/PrismaEventRepository.js";
import { prisma } from "../../../../shared/config/database.js";
import { RuleEngineService } from "../../application/RuleEngineService.js";
import { RuleController } from "../../presentation/controllers/RuleController.js";
import { RuleEvaluationController } from "../../presentation/controllers/RuleEvaluationController.js";
import { PrismaRuleRepository } from "../repositories/PrismaRuleRepository.js";

const ruleRepository = new PrismaRuleRepository(prisma);
const auditService = new AuditService(new PrismaAuditRepository(prisma));
// Read-only reuse of the Events repository to resolve an event snapshot for rule evaluation;
// no Events module files are modified, only its existing repository is instantiated here.
const eventReader = new PrismaEventRepository(prisma);

export const ruleEngineService = new RuleEngineService(ruleRepository, auditService);
export const ruleController = new RuleController(ruleEngineService);
export const ruleEvaluationController = new RuleEvaluationController(ruleEngineService, eventReader);
