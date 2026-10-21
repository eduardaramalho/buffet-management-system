import type { PrismaClient } from "../../../../generated/client.js";
import type { TransactionClient } from "../../../../shared/domain/transaction.types.js";
import type { RuleApplicationRecord, RuleApplicationRepository, RuleApplicationView } from "../../domain/task.types.js";

export class PrismaRuleApplicationRepository implements RuleApplicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByEvent(eventId: string): Promise<RuleApplicationView[]> {
    const applications = await this.prisma.ruleApplication.findMany({
      where: { eventId },
      select: { ruleId: true, appliedAt: true, rule: { select: { name: true } } },
      orderBy: { appliedAt: "desc" },
    });
    return applications.map((application) => ({ ruleId: application.ruleId, ruleName: application.rule.name, appliedAt: application.appliedAt }));
  }

  findByEventAndRule(eventId: string, ruleId: string) {
    return this.prisma.ruleApplication.findUnique({
      where: { eventId_ruleId: { eventId, ruleId } },
    }) as Promise<RuleApplicationRecord | null>;
  }

  create(eventId: string, ruleId: string, tx?: TransactionClient) {
    const client = (tx as PrismaClient | undefined) ?? this.prisma;
    return client.ruleApplication.create({ data: { eventId, ruleId } }) as Promise<RuleApplicationRecord>;
  }

  // deleteMany (not delete) so forced reprocessing is safe even when no application row exists yet.
  async remove(eventId: string, ruleId: string) {
    await this.prisma.ruleApplication.deleteMany({ where: { eventId, ruleId } });
  }
}
