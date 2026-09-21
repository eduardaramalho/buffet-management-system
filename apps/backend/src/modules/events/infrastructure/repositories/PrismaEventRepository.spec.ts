import { describe, expect, it, jest } from "@jest/globals";

import { PrismaEventRepository } from "./PrismaEventRepository.js";

describe("PrismaEventRepository", () => {
  it("finds an active event and creates one with the service relation", async () => {
    const event = { id: "event-1" };
    const findFirst = jest.fn(async () => event);
    const create = jest.fn(async () => event);
    const repository = new PrismaEventRepository({ event: { findFirst, create } } as never);

    await expect(repository.findById("event-1")).resolves.toEqual(event);
    await expect(repository.create({
      name: "Evento",
      eventDate: new Date("2026-10-10T15:00:00.000Z"),
      endDate: null,
      location: "Salao",
      serviceType: "CASAMENTO",
      guestsCount: 10,
      observations: null,
      createdById: "actor-1",
      status: "PLANEJAMENTO",
    })).resolves.toEqual(event);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "event-1", deletedAt: null } }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PLANEJAMENTO" }) }));
  });
  it("filters out soft-deleted events and applies status/date filters", async () => {
    const findMany = jest.fn(async () => []);
    const prisma = { event: { findMany } };
    const repository = new PrismaEventRepository(prisma as never);
    const from = new Date("2026-10-01T00:00:00.000Z");
    const to = new Date("2026-10-31T23:59:59.000Z");

    await repository.list({ status: "CONFIRMADO", from, to });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: null, status: "CONFIRMADO", eventDate: { gte: from, lte: to } }),
      orderBy: { eventDate: "asc" },
    }));
  });

  it("soft deletes with an update and never performs physical deletion", async () => {
    const update = jest.fn(async () => ({}));
    const prisma = { event: { update } };
    const repository = new PrismaEventRepository(prisma as never);

    await repository.softDelete("event-1");

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "event-1" },
      data: { deletedAt: expect.any(Date) },
    }));
  });

  it("updates, restores, attaches and detaches services", async () => {
    const update = jest.fn(async () => ({ id: "event-1" }));
    const upsert = jest.fn(async () => undefined);
    const findFirstOrThrow = jest.fn(async () => ({ id: "event-1" }));
    const remove = jest.fn(async () => undefined);
    const repository = new PrismaEventRepository({ event: { update, findFirstOrThrow }, eventService: { upsert, delete: remove } } as never);

    await repository.update("event-1", { location: "Jardim" });
    await repository.restore("event-1");
    await repository.attachService({ eventId: "event-1", serviceId: "service-1", customLabel: null });
    await repository.detachService("event-1", "service-1");

    expect(update).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: "event-1" }, data: { location: "Jardim" } }));
    expect(update).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: "event-1" }, data: { deletedAt: null } }));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId_serviceId: { eventId: "event-1", serviceId: "service-1" } } }));
    expect(remove).toHaveBeenCalledWith({ where: { eventId_serviceId: { eventId: "event-1", serviceId: "service-1" } } });
  });
});