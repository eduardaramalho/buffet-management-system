import { describe, expect, it, jest } from "@jest/globals";
import { PrismaAuditRepository } from "./PrismaAuditRepository.js";

describe("PrismaAuditRepository", () => {
  it("loads event history with actor names in one query and the requested limit", async () => {
    const findMany = jest.fn(async (_input: unknown) => ([
      { id: "audit-1", action: "EVENT_CREATED", entity: "Event", entityId: "event-1", changes: { name: "Evento" }, createdAt: new Date("2026-10-01"), actor: { name: "Ana" } },
    ]));
    const repository = new PrismaAuditRepository({ auditLog: { findMany } } as never);

    await expect(repository.listByEntity("Event", "event-1", 20)).resolves.toEqual([
      { id: "audit-1", action: "EVENT_CREATED", entity: "Event", entityId: "event-1", changes: { name: "Evento" }, actorName: "Ana", createdAt: new Date("2026-10-01") },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { entity: "Event", entityId: "event-1" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { name: true } } },
    });
  });
});