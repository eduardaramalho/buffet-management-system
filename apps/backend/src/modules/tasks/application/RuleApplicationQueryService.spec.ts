import { describe, expect, it, jest } from "@jest/globals";
import { RuleApplicationQueryService } from "./RuleApplicationQueryService.js";

describe("RuleApplicationQueryService", () => {
  it("returns applications ordered by most recent and rejects missing events", async () => {
    const findById = jest.fn(async () => ({ id: "event-1" }));
    const listByEvent = jest.fn(async () => [
      { ruleId: "rule-old", ruleName: "Antiga", appliedAt: new Date("2026-10-01") },
      { ruleId: "rule-new", ruleName: "Nova", appliedAt: new Date("2026-10-02") },
    ]);
    const service = new RuleApplicationQueryService({ findById } as never, { listByEvent } as never);

    await expect(service.listByEvent("event-1")).resolves.toEqual([
      { ruleId: "rule-new", ruleName: "Nova", appliedAt: new Date("2026-10-02") },
      { ruleId: "rule-old", ruleName: "Antiga", appliedAt: new Date("2026-10-01") },
    ]);

    findById.mockResolvedValue(null);
    await expect(service.listByEvent("event-1")).rejects.toThrow("Evento não encontrado");
    expect(listByEvent).toHaveBeenCalledTimes(1);
  });
});