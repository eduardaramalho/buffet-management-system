import { describe, expect, it, jest } from "@jest/globals";

import { PrismaRuleTaskTemplateRepository } from "./PrismaRuleTaskTemplateRepository.js";

describe("PrismaRuleTaskTemplateRepository", () => {
  it("lists task templates by ruleId", async () => {
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaRuleTaskTemplateRepository({ ruleTaskTemplate: { findMany } } as never);

    await repository.listByRuleId("rule-1");

    expect(findMany).toHaveBeenCalledWith({ where: { ruleId: "rule-1" } });
  });
});
