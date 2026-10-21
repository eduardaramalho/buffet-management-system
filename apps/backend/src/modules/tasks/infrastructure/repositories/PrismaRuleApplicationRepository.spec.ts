import { describe, expect, it, jest } from "@jest/globals";

import { PrismaRuleApplicationRepository } from "./PrismaRuleApplicationRepository.js";

describe("PrismaRuleApplicationRepository", () => {
  it("finds a rule application by (eventId, ruleId)", async () => {
    const findUnique = jest.fn(async (_input: unknown) => null);
    const repository = new PrismaRuleApplicationRepository({ ruleApplication: { findUnique } } as never);

    await repository.findByEventAndRule("event-1", "rule-1");

    expect(findUnique).toHaveBeenCalledWith({ where: { eventId_ruleId: { eventId: "event-1", ruleId: "rule-1" } } });
  });

  it("lists applications with the rule name and newest first", async () => {
    const findMany = jest.fn(async (_input: unknown) => ([
      { ruleId: "rule-1", appliedAt: new Date("2026-10-02"), rule: { name: "Regra" } },
    ]));
    const repository = new PrismaRuleApplicationRepository({ ruleApplication: { findMany } } as never);

    await expect(repository.listByEvent("event-1")).resolves.toEqual([
      { ruleId: "rule-1", ruleName: "Regra", appliedAt: new Date("2026-10-02") },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { eventId: "event-1" },
      select: { ruleId: true, appliedAt: true, rule: { select: { name: true } } },
      orderBy: { appliedAt: "desc" },
    });
  });

  it("creates a rule application", async () => {
    const create = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaRuleApplicationRepository({ ruleApplication: { create } } as never);

    await repository.create("event-1", "rule-1");

    expect(create).toHaveBeenCalledWith({ data: { eventId: "event-1", ruleId: "rule-1" } });
  });

  it("removes a rule application without throwing when none exists (forced reprocessing)", async () => {
    const deleteMany = jest.fn(async (_input: unknown) => ({ count: 0 }));
    const repository = new PrismaRuleApplicationRepository({ ruleApplication: { deleteMany } } as never);

    await repository.remove("event-1", "rule-1");

    expect(deleteMany).toHaveBeenCalledWith({ where: { eventId: "event-1", ruleId: "rule-1" } });
  });
});
