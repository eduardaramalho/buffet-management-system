import { describe, expect, it, jest } from "@jest/globals";
import { AuditHistoryService } from "./AuditHistoryService.js";

describe("AuditHistoryService", () => {
  it("limits event history to 20 records, includes the actor name, and omits changes", async () => {
    const logs = Array.from({ length: 21 }, (_, index) => ({
      id: `audit-${index}`,
      action: "EVENT_UPDATED",
      entity: "Event",
      entityId: "event-1",
      changes: { name: "Casamento" },
      actorName: "Ana",
      createdAt: new Date(`2026-10-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`),
    }));
    const findById = jest.fn(async () => ({ id: "event-1" }));
    const listByEntity = jest.fn(async () => logs);
    const service = new AuditHistoryService({ findById } as never, { listByEntity } as never);

    const history = await service.listEventHistory("event-1");

    expect(history).toHaveLength(20);
    expect(history[0]).toEqual(expect.objectContaining({ id: "audit-0", actorName: "Ana" }));
    expect(history[0]).not.toHaveProperty("changes");
    expect(history[0]).not.toHaveProperty("action");
    expect(history[0]).not.toHaveProperty("entity");
    expect(history[0]).not.toHaveProperty("entityId");
    expect(listByEntity).toHaveBeenCalledWith("Event", "event-1", 20);
  });

  it("returns only business information (what, who, when) without technical codes", async () => {
    const findById = jest.fn(async () => ({ id: "event-1", name: "Casamento" }));
    const listByEntity = jest.fn(async () => [
      { id: "a1", action: "EVENT_UPDATED", entity: "Event", entityId: "event-1", changes: {}, actorName: "Ana", createdAt: new Date("2026-10-01T10:00:00.000Z") },
      { id: "a2", action: "TEAM_ASSIGNED_TO_EVENT", entity: "Event", entityId: "event-1", changes: { teamId: "t1" }, actorName: null, createdAt: new Date("2026-10-02T10:00:00.000Z") },
    ]);
    const service = new AuditHistoryService({ findById } as never, { listByEntity } as never);

    const history = await service.listEventHistory("event-1");

    expect(history).toEqual([
      { id: "a1", message: "Dados do evento 'Casamento' atualizados", actorName: "Ana", createdAt: new Date("2026-10-01T10:00:00.000Z") },
      { id: "a2", message: "Equipe alocada ao evento 'Casamento'", actorName: null, createdAt: new Date("2026-10-02T10:00:00.000Z") },
    ]);
  });

  it("rejects a missing or soft-deleted event", async () => {
    const findById = jest.fn(async () => null);
    const listByEntity = jest.fn();
    const service = new AuditHistoryService({ findById } as never, { listByEntity } as never);

    await expect(service.listEventHistory("event-1")).rejects.toThrow("Evento não encontrado");
    expect(listByEntity).not.toHaveBeenCalled();
  });
});