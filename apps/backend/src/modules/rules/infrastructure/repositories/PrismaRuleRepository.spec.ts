import { describe, expect, it, jest } from "@jest/globals";

import { PrismaRuleRepository } from "./PrismaRuleRepository.js";

describe("PrismaRuleRepository", () => {
  it("lists only non-deleted rules with their resource requirements", async () => {
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaRuleRepository({ rule: { findMany } } as never);

    await repository.list({ isActive: true, search: "Casamento" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null, isActive: true, name: { contains: "Casamento" } }),
        include: expect.any(Object),
      }),
    );
  });

  it("lists all non-deleted rules when no extra filters are given", async () => {
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaRuleRepository({ rule: { findMany } } as never);

    await repository.list({});

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
  });

  it("lists only active, non-deleted rules for evaluation", async () => {
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaRuleRepository({ rule: { findMany } } as never);

    await repository.listActive();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, isActive: true } }),
    );
  });

  it("finds a rule by id excluding deleted records", async () => {
    const findFirst = jest.fn(async (_input: unknown) => null);
    const repository = new PrismaRuleRepository({ rule: { findFirst } } as never);

    await repository.findById("rule-1");

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "rule-1", deletedAt: null } }));
  });

  it("creates a rule together with its resource requirements", async () => {
    const create = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaRuleRepository({ rule: { create } } as never);

    await repository.create({
      name: "Regra A",
      description: null,
      conditionServiceTypeIn: null,
      conditionMinGuests: null,
      conditionMaxGuests: null,
      conditionRequiredServiceIds: null,
      createdById: "actor-1",
      resourceRequirements: [{ specialty: "BAR", minQuantity: 1 }],
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Regra A",
          resourceRequirements: { create: [{ specialty: "BAR", minQuantity: 1 }] },
        }),
      }),
    );
  });

  it("soft-deletes a rule", async () => {
    const update = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaRuleRepository({ rule: { update } } as never);

    await repository.softDelete("rule-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rule-1" }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });

  it("updates a rule without touching resource requirements when they are not provided", async () => {
    const update = jest.fn(async (_input: unknown) => ({}));
    const deleteMany = jest.fn(async (_input: unknown) => ({}));
    const templateDeleteMany = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaRuleRepository({ rule: { update }, ruleResourceRequirement: { deleteMany }, ruleTaskTemplate: { deleteMany: templateDeleteMany } } as never);

    await repository.update("rule-1", { name: "Regra B" });

    expect(deleteMany).not.toHaveBeenCalled();
    expect(templateDeleteMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "rule-1" }, data: { name: "Regra B" } }));
  });

  it("replaces resource requirements when a new list is provided", async () => {
    const update = jest.fn(async (_input: unknown) => ({}));
    const deleteMany = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaRuleRepository({ rule: { update }, ruleResourceRequirement: { deleteMany } } as never);

    await repository.update("rule-1", { resourceRequirements: [{ specialty: "SALAO", minQuantity: 2 }] });

    expect(deleteMany).toHaveBeenCalledWith({ where: { ruleId: "rule-1" } });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resourceRequirements: { create: [{ specialty: "SALAO", minQuantity: 2 }] } }),
      }),
    );
  });

  it("replaces task templates only when taskTemplates is provided", async () => {
    const update = jest.fn(async (_input: unknown) => ({}));
    const deleteMany = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaRuleRepository({ rule: { update }, ruleTaskTemplate: { deleteMany } } as never);

    await repository.update("rule-1", { name: "Preserva" });
    expect(deleteMany).not.toHaveBeenCalled();

    await repository.update("rule-1", { taskTemplates: [] });
    expect(deleteMany).toHaveBeenCalledWith({ where: { ruleId: "rule-1" } });
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ taskTemplates: { create: [] } }) }));
  });
});
