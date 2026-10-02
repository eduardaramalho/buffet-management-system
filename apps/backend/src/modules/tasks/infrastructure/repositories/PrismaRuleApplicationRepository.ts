import type { PrismaClient } from "../../../../generated/client.js";
import type { TransactionClient } from "../../../../shared/domain/transaction.types.js";
import type { RuleApplicationRecord, RuleApplicationRepository } from "../../domain/task.types.js";

export class PrismaRuleApplicationRepository implements RuleApplicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

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
