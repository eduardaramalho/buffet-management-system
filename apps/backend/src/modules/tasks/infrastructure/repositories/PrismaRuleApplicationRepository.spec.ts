import { describe, expect, it, jest } from "@jest/globals";

import { PrismaRuleApplicationRepository } from "./PrismaRuleApplicationRepository.js";

describe("PrismaRuleApplicationRepository", () => {
  it("finds a rule application by (eventId, ruleId)", async () => {
    const findUnique = jest.fn(async (_input: unknown) => null);
    const repository = new PrismaRuleApplicationRepository({ ruleApplication: { findUnique } } as never);

    await repository.findByEventAndRule("event-1", "rule-1");

    expect(findUnique).toHaveBeenCalledWith({ where: { eventId_ruleId: { eventId: "event-1", ruleId: "rule-1" } } });
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
