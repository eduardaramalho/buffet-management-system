import { describe, expect, it, jest } from "@jest/globals";

import { RuleEngineService } from "./RuleEngineService.js";
import type { AuditService, CreateRuleInput, RuleRecord, RuleRepository } from "../domain/rule.types.js";
import type { TransactionRunner } from "../../../shared/domain/transaction.types.js";

const makeRule = (overrides: Partial<RuleRecord> = {}): RuleRecord => ({
  id: "rule-1",
  name: "Casamento grande precisa de bar",
  description: null,
  isActive: true,
  conditionServiceTypeIn: null,
  conditionMinGuests: null,
  conditionMaxGuests: null,
  conditionRequiredServiceIds: null,
  createdById: "actor-1",
  createdAt: new Date("2026-09-28T00:00:00.000Z"),
  updatedAt: new Date("2026-09-28T00:00:00.000Z"),
  deletedAt: null,
  resourceRequirements: [{ id: "req-1", specialty: "BAR", minQuantity: 1 }],
  taskTemplates: [],
  ...overrides,
});

describe("RuleEngineService", () => {
  const transactions = { run: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})) } as unknown as TransactionRunner;

  describe("CRUD", () => {
    it("lists and gets an existing rule", async () => {
      const rule = makeRule();
      const rules = {
        list: jest.fn(async () => [rule]),
        findById: jest.fn(async () => rule),
      } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      await expect(service.list({ isActive: true })).resolves.toEqual([rule]);
      await expect(service.get("rule-1")).resolves.toEqual(rule);
    });

    it("rejects getting a missing rule", async () => {
      const rules = { findById: jest.fn(async () => null) } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      await expect(service.get("missing")).rejects.toThrow("Regra não encontrada");
    });

    it("creates a valid rule and records audit", async () => {
      const input: CreateRuleInput = {
        name: "Casamento grande precisa de bar",
        description: null,
        conditionServiceTypeIn: ["CASAMENTO"],
        conditionMinGuests: 100,
        conditionMaxGuests: null,
        conditionRequiredServiceIds: null,
        createdById: "actor-1",
        resourceRequirements: [{ specialty: "BAR", minQuantity: 1 }],
      };
      const rules = {
        create: jest.fn(async (_ruleInput: CreateRuleInput) => makeRule({ resourceRequirements: [{ id: "req-1", specialty: "BAR", minQuantity: 1 }] })),
      } as unknown as RuleRepository;
      const audit = { record: jest.fn() } as unknown as AuditService;
      const service = new RuleEngineService(rules, audit);

      const result = await service.create(input);

      expect(rules.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Casamento grande precisa de bar" }));
      expect(result.name).toBe("Casamento grande precisa de bar");
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "RULE_CREATED", entity: "Rule", entityId: "rule-1", userId: "actor-1" }),
      );
    });

    it("persists two task templates in the same transaction when creating a rule", async () => {
      const input = {
        name: "Regra com tarefas",
        description: null,
        conditionServiceTypeIn: null,
        conditionMinGuests: null,
        conditionMaxGuests: null,
        conditionRequiredServiceIds: null,
        resourceRequirements: [],
        taskTemplates: [
          { title: "Confirmar fornecedor", description: null, daysBeforeEvent: 10, specialty: null },
          { title: "Separar materiais", description: "Checklist", daysBeforeEvent: 2, specialty: null },
        ],
        createdById: "actor-1",
      } as unknown as CreateRuleInput;
      const rules = { create: jest.fn(async () => makeRule()) } as unknown as RuleRepository;
      const audit = { record: jest.fn() } as unknown as AuditService;
      const service = new RuleEngineService(rules, audit, transactions);

      await service.create(input);

      expect(transactions.run).toHaveBeenCalled();
      expect(rules.create).toHaveBeenCalledWith(expect.objectContaining({ taskTemplates: input.taskTemplates }), expect.anything());
    });

    it("rejects repeated task template titles", async () => {
      const rules = { create: jest.fn() } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService, transactions);

      await expect(service.create({
        name: "Regra inválida",
        description: null,
        conditionServiceTypeIn: null,
        conditionMinGuests: null,
        conditionMaxGuests: null,
        conditionRequiredServiceIds: null,
        resourceRequirements: [],
        taskTemplates: [{ title: "  Preparar salão " }, { title: "Preparar salão" }],
        createdById: "actor-1",
      } as unknown as CreateRuleInput)).rejects.toThrow("títulos das tarefas");
      expect(rules.create).not.toHaveBeenCalled();
    });

    it("rejects a negative daysBeforeEvent in the service", async () => {
      const rules = { create: jest.fn() } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService, transactions);

      await expect(service.create({
        name: "Regra inválida",
        description: null,
        conditionServiceTypeIn: null,
        conditionMinGuests: null,
        conditionMaxGuests: null,
        conditionRequiredServiceIds: null,
        resourceRequirements: [],
        taskTemplates: [{ title: "Preparar", daysBeforeEvent: -1 }],
        createdById: "actor-1",
      } as unknown as CreateRuleInput)).rejects.toThrow("0 e 365");
      expect(rules.create).not.toHaveBeenCalled();
    });

    it("rejects more than twenty task templates", async () => {
      const rules = { create: jest.fn() } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService, transactions);

      await expect(service.create({
        name: "Regra inválida",
        description: null,
        conditionServiceTypeIn: null,
        conditionMinGuests: null,
        conditionMaxGuests: null,
        conditionRequiredServiceIds: null,
        resourceRequirements: [],
        taskTemplates: Array.from({ length: 21 }, (_, index) => ({ title: `Tarefa ${index}` })),
        createdById: "actor-1",
      } as unknown as CreateRuleInput)).rejects.toThrow("20");
      expect(rules.create).not.toHaveBeenCalled();
    });

    it("rejects a rule with an empty name", async () => {
      const rules = { create: jest.fn() } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      await expect(
        service.create({
          name: "   ",
          description: null,
          conditionServiceTypeIn: null,
          conditionMinGuests: null,
          conditionMaxGuests: null,
          conditionRequiredServiceIds: null,
          createdById: "actor-1",
          resourceRequirements: [],
        }),
      ).rejects.toThrow("nome");
      expect(rules.create).not.toHaveBeenCalled();
    });

    it("rejects a rule where the guest minimum exceeds the maximum", async () => {
      const rules = { create: jest.fn() } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      await expect(
        service.create({
          name: "Regra inválida",
          description: null,
          conditionServiceTypeIn: null,
          conditionMinGuests: 200,
          conditionMaxGuests: 100,
          conditionRequiredServiceIds: null,
          createdById: "actor-1",
          resourceRequirements: [],
        }),
      ).rejects.toThrow("mínimo de convidados");
      expect(rules.create).not.toHaveBeenCalled();
    });

    it("rejects a resource requirement with less than 1 minimum quantity", async () => {
      const rules = { create: jest.fn() } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      await expect(
        service.create({
          name: "Regra inválida",
          description: null,
          conditionServiceTypeIn: null,
          conditionMinGuests: null,
          conditionMaxGuests: null,
          conditionRequiredServiceIds: null,
          createdById: "actor-1",
          resourceRequirements: [{ specialty: "BAR", minQuantity: 0 }],
        }),
      ).rejects.toThrow("quantidade mínima");
      expect(rules.create).not.toHaveBeenCalled();
    });

    it("rejects a resource requirement with less than 1 minimum quantity on update", async () => {
      const rule = makeRule();
      const rules = { findById: jest.fn(async () => rule), update: jest.fn() } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      await expect(
        service.update("rule-1", { resourceRequirements: [{ specialty: "SALAO", minQuantity: 0 }] }, "actor-1"),
      ).rejects.toThrow("quantidade mínima");
      expect(rules.update).not.toHaveBeenCalled();
    });

    it("updates and soft-deletes a rule with audits", async () => {
      const rule = makeRule();
      const updated = makeRule({ name: "Regra atualizada" });
      const rules = {
        findById: jest.fn(async () => rule),
        update: jest.fn(async () => updated),
        softDelete: jest.fn(async () => updated),
      } as unknown as RuleRepository;
      const audit = { record: jest.fn() } as unknown as AuditService;
      const service = new RuleEngineService(rules, audit);

      await service.update("rule-1", { name: "Regra atualizada" }, "actor-1");
      await service.remove("rule-1", "actor-1");

      expect(rules.update).toHaveBeenCalledWith("rule-1", expect.objectContaining({ name: "Regra atualizada" }));
      expect(rules.softDelete).toHaveBeenCalledWith("rule-1");
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "RULE_UPDATED" }));
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "RULE_DELETED" }));
    });

    it("includes template changes in the update audit", async () => {
      const current = makeRule({ taskTemplates: [{ id: "tpl-1", ruleId: "rule-1", title: "Antiga", description: null, daysBeforeEvent: null }] } as never);
      const updated = makeRule({ taskTemplates: [{ id: "tpl-2", ruleId: "rule-1", title: "Nova", description: null, daysBeforeEvent: 3 }] } as never);
      const rules = {
        findById: jest.fn(async () => current),
        update: jest.fn(async () => updated),
      } as unknown as RuleRepository;
      const audit = { record: jest.fn() } as unknown as AuditService;
      const service = new RuleEngineService(rules, audit, transactions);

      await service.update("rule-1", { taskTemplates: [{ title: "Nova", description: null, daysBeforeEvent: 3 }] } as never, "actor-1");

      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
        action: "RULE_UPDATED",
        changes: expect.objectContaining({ beforeTaskTemplates: current.taskTemplates, afterTaskTemplates: updated.taskTemplates }),
      }));
    });

    it("rejects updating a missing rule", async () => {
      const rules = { findById: jest.fn(async () => null) } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      await expect(service.update("missing", { name: "Nova" }, "actor-1")).rejects.toThrow("Regra não encontrada");
    });

    it("rejects updating min/max guests to an inconsistent range using the stored value", async () => {
      const rule = makeRule({ conditionMinGuests: null, conditionMaxGuests: 200 });
      const rules = { findById: jest.fn(async () => rule), update: jest.fn() } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      await expect(service.update("rule-1", { conditionMinGuests: 300 }, "actor-1")).rejects.toThrow("mínimo de convidados");
      expect(rules.update).not.toHaveBeenCalled();
    });

    it("activates and deactivates a rule with audit", async () => {
      const rule = makeRule({ isActive: false });
      const rules = {
        findById: jest.fn(async () => rule),
        update: jest.fn(async (_id: string, input: { isActive?: boolean }) => makeRule({ isActive: input.isActive })),
      } as unknown as RuleRepository;
      const audit = { record: jest.fn() } as unknown as AuditService;
      const service = new RuleEngineService(rules, audit);

      await service.setActive("rule-1", true, "actor-1");

      expect(rules.update).toHaveBeenCalledWith("rule-1", { isActive: true });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "RULE_UPDATED", entityId: "rule-1", changes: { isActive: true } }),
      );
    });

    it("rejects activating a missing rule", async () => {
      const rules = { findById: jest.fn(async () => null) } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      await expect(service.setActive("missing", true, "actor-1")).rejects.toThrow("Regra não encontrada");
    });
  });

  describe("evaluate", () => {
    it("matches a rule with no conditions against any event", async () => {
      const rule = makeRule({ conditionServiceTypeIn: null, conditionMinGuests: null, conditionMaxGuests: null, conditionRequiredServiceIds: null });
      const rules = { listActive: jest.fn(async () => [rule]) } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      const result = await service.evaluate({ serviceType: "OUTRO", guestsCount: 5 }, []);

      expect(result).toEqual([{ rule, resourceRequirements: rule.resourceRequirements }]);
    });

    it("matches a rule whose every filled condition satisfies the event", async () => {
      const rule = makeRule({
        conditionServiceTypeIn: ["CASAMENTO"],
        conditionMinGuests: 80,
        conditionMaxGuests: 200,
        conditionRequiredServiceIds: ["service-bar"],
      });
      const rules = { listActive: jest.fn(async () => [rule]) } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      const result = await service.evaluate({ serviceType: "CASAMENTO", guestsCount: 100 }, ["service-bar", "service-decor"]);

      expect(result).toEqual([{ rule, resourceRequirements: rule.resourceRequirements }]);
    });

    it("excludes a rule when one of its conditions does not match", async () => {
      const rule = makeRule({ conditionServiceTypeIn: ["FORMATURA"] });
      const rules = { listActive: jest.fn(async () => [rule]) } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      const result = await service.evaluate({ serviceType: "CASAMENTO", guestsCount: 100 }, []);

      expect(result).toEqual([]);
    });

    it("never returns an inactive rule even if the repository mistakenly includes one", async () => {
      const inactiveRule = makeRule({ isActive: false });
      const rules = { listActive: jest.fn(async () => [inactiveRule]) } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      const result = await service.evaluate({ serviceType: "CASAMENTO", guestsCount: 100 }, []);

      expect(result).toEqual([]);
    });

    it("returns an empty list, not an error, when no rule matches the event", async () => {
      const rules = {
        listActive: jest.fn(async () => [makeRule({ conditionMinGuests: 500 })]),
      } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      await expect(service.evaluate({ serviceType: "CASAMENTO", guestsCount: 50 }, [])).resolves.toEqual([]);
    });

    it("never writes to the repository or calls the audit service", async () => {
      const rule = makeRule();
      const rules = { listActive: jest.fn(async () => [rule]) } as unknown as RuleRepository;
      const audit = { record: jest.fn() } as unknown as AuditService;
      const service = new RuleEngineService(rules, audit);

      await service.evaluate({ serviceType: "CASAMENTO", guestsCount: 100 }, []);

      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe("task template specialty (RFC 3.1, ADR 0010)", () => {
    const input = (overrides: Partial<CreateRuleInput> = {}): CreateRuleInput => ({
      name: "Casamento com bar", description: null, conditionServiceTypeIn: null, conditionMinGuests: null, conditionMaxGuests: null,
      conditionRequiredServiceIds: null, createdById: "actor-1",
      resourceRequirements: [{ specialty: "BAR", minQuantity: 1 }],
      taskTemplates: [{ title: "Montar o bar", specialty: "BAR" }],
      ...overrides,
    });

    it("stores the specialty of each template, defaulting to null", async () => {
      const create = jest.fn(async (data: unknown) => makeRule({ taskTemplates: [] , ...(data as object) }));
      const service = new RuleEngineService({ create } as unknown as RuleRepository, { record: jest.fn() } as unknown as AuditService);

      await service.create(input({ taskTemplates: [{ title: "Montar o bar", specialty: "BAR" }, { title: "Lembrete" }] }));

      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        taskTemplates: [
          { title: "Montar o bar", description: null, specialty: "BAR" },
          { title: "Lembrete", description: null, specialty: null },
        ],
      }));
    });

    it("rejects a template specialty the rule does not require", async () => {
      const create = jest.fn();
      const service = new RuleEngineService({ create } as unknown as RuleRepository, { record: jest.fn() } as unknown as AuditService);

      await expect(service.create(input({ taskTemplates: [{ title: "Montar mesas", specialty: "SALAO" }] })))
        .rejects.toThrow("A especialidade da tarefa 'Montar mesas' precisa estar entre as equipes exigidas pela regra");
      expect(create).not.toHaveBeenCalled();
    });

    it("on update, checks against the requirements kept from the current rule, and against the current templates when only requirements change", async () => {
      const current = makeRule({
        resourceRequirements: [{ id: "req-1", specialty: "BAR", minQuantity: 1 }],
        taskTemplates: [{ id: "tpl-1", ruleId: "rule-1", title: "Montar o bar", description: null, daysBeforeEvent: null, specialty: "BAR" }],
      });
      const update = jest.fn(async () => current);
      const rules = { findById: jest.fn(async () => current), update } as unknown as RuleRepository;
      const service = new RuleEngineService(rules, { record: jest.fn() } as unknown as AuditService);

      await expect(service.update("rule-1", { taskTemplates: [{ title: "Montar o bar", specialty: "BAR" }] }, "actor-1")).resolves.toBeDefined();
      await expect(service.update("rule-1", { taskTemplates: [{ title: "Montar mesas", specialty: "SALAO" }] }, "actor-1")).rejects.toThrow("precisa estar entre as equipes exigidas");
      await expect(service.update("rule-1", { resourceRequirements: [{ specialty: "COZINHA", minQuantity: 1 }] }, "actor-1")).rejects.toThrow("A especialidade da tarefa 'Montar o bar'");
      expect(update).toHaveBeenCalledTimes(1);
    });
  });
});
