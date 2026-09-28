import { Prisma } from "../../../../generated/client.js";
import type { PrismaClient } from "../../../../generated/client.js";
import type { CreateRuleInput, RuleListFilter, RuleRecord, RuleRepository, UpdateRuleInput } from "../../domain/rule.types.js";

const ruleInclude = { resourceRequirements: true } as const;

// Prisma's Json columns require the `Prisma.JsonNull` sentinel to store an actual JSON null value;
// a plain `null` is ambiguous with "leave the column untouched" for nullable Json fields.
const toJsonInput = (value: string[] | null | undefined) =>
  value === undefined ? undefined : value === null ? Prisma.JsonNull : value;

export class PrismaRuleRepository implements RuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateRuleInput) {
    const { resourceRequirements, conditionServiceTypeIn, conditionRequiredServiceIds, ...rule } = input;
    return this.prisma.rule.create({
      data: {
        ...rule,
        conditionServiceTypeIn: toJsonInput(conditionServiceTypeIn),
        conditionRequiredServiceIds: toJsonInput(conditionRequiredServiceIds),
        resourceRequirements: { create: resourceRequirements },
      },
      include: ruleInclude,
    }) as unknown as Promise<RuleRecord>;
  }

  findById(id: string) {
    return this.prisma.rule.findFirst({ where: { id, deletedAt: null }, include: ruleInclude }) as unknown as Promise<RuleRecord | null>;
  }

  list(filter: RuleListFilter) {
    return this.prisma.rule.findMany({
      where: {
        deletedAt: null,
        ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
        ...(filter.search ? { name: { contains: filter.search } } : {}),
      },
      orderBy: { name: "asc" },
      include: ruleInclude,
    }) as unknown as Promise<RuleRecord[]>;
  }

  listActive() {
    return this.prisma.rule.findMany({
      where: { deletedAt: null, isActive: true },
      include: ruleInclude,
    }) as unknown as Promise<RuleRecord[]>;
  }

  async update(id: string, input: UpdateRuleInput) {
    const { resourceRequirements, conditionServiceTypeIn, conditionRequiredServiceIds, ...rule } = input;
    if (resourceRequirements) {
      // A rule's resource requirements are fully replaced on update — there is no history to preserve per item.
      await this.prisma.ruleResourceRequirement.deleteMany({ where: { ruleId: id } });
    }

    return this.prisma.rule.update({
      where: { id },
      data: {
        ...rule,
        conditionServiceTypeIn: toJsonInput(conditionServiceTypeIn),
        conditionRequiredServiceIds: toJsonInput(conditionRequiredServiceIds),
        ...(resourceRequirements ? { resourceRequirements: { create: resourceRequirements } } : {}),
      },
      include: ruleInclude,
    }) as unknown as Promise<RuleRecord>;
  }

  softDelete(id: string) {
    return this.prisma.rule.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: ruleInclude,
    }) as unknown as Promise<RuleRecord>;
  }
}
