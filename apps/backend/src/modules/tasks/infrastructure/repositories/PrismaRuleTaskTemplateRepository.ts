import type { PrismaClient } from "../../../../generated/client.js";
import type { RuleTaskTemplateRecord, RuleTaskTemplateRepository } from "../../domain/task.types.js";

export class PrismaRuleTaskTemplateRepository implements RuleTaskTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listByRuleId(ruleId: string) {
    return this.prisma.ruleTaskTemplate.findMany({ where: { ruleId } }) as Promise<RuleTaskTemplateRecord[]>;
  }
}
