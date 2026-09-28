import { ruleMatchesEvent, toMatchedRule } from "./ruleMatcher.js";
import type {
  AuditService,
  CreateRuleInput,
  MatchedRule,
  RuleEvaluationEvent,
  RuleListFilter,
  RuleRepository,
  UpdateRuleInput,
} from "../domain/rule.types.js";

export class RuleManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleManagementError";
  }
}

const MIN_QUANTITY_FLOOR = 1;

// null/undefined and empty arrays both mean "no restriction" for list-based conditions.
const normalizeConditionList = <T>(values: T[] | null | undefined): T[] | null => (values && values.length > 0 ? values : null);

export class RuleEngineService {
  constructor(
    private readonly rules: RuleRepository,
    private readonly audit: AuditService,
  ) {}

  private assertConsistentCondition(
    minGuests: number | null | undefined,
    maxGuests: number | null | undefined,
    resourceRequirements: CreateRuleInput["resourceRequirements"] | undefined,
  ) {
    if (minGuests != null && maxGuests != null && minGuests > maxGuests) {
      throw new RuleManagementError("O mínimo de convidados não pode ser maior que o máximo");
    }
    for (const requirement of resourceRequirements ?? []) {
      if (requirement.minQuantity < MIN_QUANTITY_FLOOR) {
        throw new RuleManagementError("A quantidade mínima de cada especialidade deve ser ao menos 1");
      }
    }
  }

  async create(input: CreateRuleInput) {
    const name = input.name.trim();
    if (!name) throw new RuleManagementError("O nome da regra é obrigatório");
    this.assertConsistentCondition(input.conditionMinGuests, input.conditionMaxGuests, input.resourceRequirements);

    const rule = await this.rules.create({
      ...input,
      name,
      conditionServiceTypeIn: normalizeConditionList(input.conditionServiceTypeIn),
      conditionRequiredServiceIds: normalizeConditionList(input.conditionRequiredServiceIds),
    });
    await this.audit.record({
      userId: input.createdById,
      action: "RULE_CREATED",
      entity: "Rule",
      entityId: rule.id,
      changes: { name: rule.name },
    });
    return rule;
  }

  list(filter: RuleListFilter = {}) {
    return this.rules.list(filter);
  }

  async get(id: string) {
    const rule = await this.rules.findById(id);
    if (!rule) throw new RuleManagementError("Regra não encontrada");
    return rule;
  }

  async update(id: string, input: UpdateRuleInput, actorId: string) {
    const current = await this.get(id);
    if (input.name !== undefined && !input.name.trim()) {
      throw new RuleManagementError("O nome da regra é obrigatório");
    }

    const minGuests = input.conditionMinGuests !== undefined ? input.conditionMinGuests : current.conditionMinGuests;
    const maxGuests = input.conditionMaxGuests !== undefined ? input.conditionMaxGuests : current.conditionMaxGuests;
    this.assertConsistentCondition(minGuests, maxGuests, input.resourceRequirements);

    const updated = await this.rules.update(id, {
      ...input,
      name: input.name?.trim(),
      conditionServiceTypeIn:
        input.conditionServiceTypeIn !== undefined ? normalizeConditionList(input.conditionServiceTypeIn) : undefined,
      conditionRequiredServiceIds:
        input.conditionRequiredServiceIds !== undefined ? normalizeConditionList(input.conditionRequiredServiceIds) : undefined,
    });
    await this.audit.record({
      userId: actorId,
      action: "RULE_UPDATED",
      entity: "Rule",
      entityId: id,
      changes: { after: updated },
    });
    return updated;
  }

  async remove(id: string, actorId: string) {
    await this.get(id);
    const deleted = await this.rules.softDelete(id);
    await this.audit.record({
      userId: actorId,
      action: "RULE_DELETED",
      entity: "Rule",
      entityId: id,
    });
    return deleted;
  }

  async setActive(id: string, isActive: boolean, actorId: string) {
    await this.get(id);
    const updated = await this.rules.update(id, { isActive });
    await this.audit.record({
      userId: actorId,
      action: "RULE_UPDATED",
      entity: "Rule",
      entityId: id,
      changes: { isActive },
    });
    return updated;
  }

  // Pure query: no writes, no audit calls. Rules are filtered by isActive again here as a
  // safety net, even though the repository's listActive() already excludes inactive ones.
  async evaluate(event: RuleEvaluationEvent, contractedServiceIds: string[]): Promise<MatchedRule[]> {
    const activeRules = await this.rules.listActive();
    return activeRules
      .filter((rule) => rule.isActive)
      .filter((rule) => ruleMatchesEvent(rule, { ...event, contractedServiceIds }))
      .map(toMatchedRule);
  }
}
