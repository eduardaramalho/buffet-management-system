import { describe, expect, it } from "@jest/globals";

import { canTransitionTaskStatus, TASK_STATUS_TRANSITIONS } from "./task.statusTransitions.js";
import { taskStatuses } from "./task.types.js";

describe("task status transitions (ADR 0014)", () => {
  it.each([
    ["PENDENTE", "EM_ANDAMENTO"],
    ["PENDENTE", "CANCELADA"],
    ["EM_ANDAMENTO", "PENDENTE"],
    ["EM_ANDAMENTO", "CONCLUIDA"],
    ["EM_ANDAMENTO", "CANCELADA"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(canTransitionTaskStatus(from, to)).toBe(true);
  });

  it.each([
    ["PENDENTE", "CONCLUIDA"],
    ["CONCLUIDA", "CANCELADA"],
    ["CANCELADA", "CONCLUIDA"],
    ["CONCLUIDA", "EM_ANDAMENTO"],
    ["CANCELADA", "PENDENTE"],
  ] as const)("refuses %s -> %s", (from, to) => {
    expect(canTransitionTaskStatus(from, to)).toBe(false);
  });

  it("never allows a transition to the same status and keeps the terminal statuses closed", () => {
    for (const status of taskStatuses) expect(canTransitionTaskStatus(status, status)).toBe(false);
    expect(TASK_STATUS_TRANSITIONS.CONCLUIDA).toEqual([]);
    expect(TASK_STATUS_TRANSITIONS.CANCELADA).toEqual([]);
  });
});
