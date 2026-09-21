import { describe, expect, it, jest } from "@jest/globals";

import { EventManagementService } from "./EventManagementService.js";
import type { EventRepository, EventRecord, CreateEventInput, ServiceRepository, EventAuditService } from "../domain/event.types.js";

const makeEvent = (overrides: Partial<EventRecord> = {}): EventRecord => ({
  id: "event-1",
  name: "Casamento de Alice",
  eventDate: new Date("2026-10-10T15:00:00.000Z"),
  endDate: null,
  location: "Salao Principal",
  serviceType: "CASAMENTO",
  guestsCount: 100,
  observations: null,
  status: "PLANEJAMENTO",
  createdById: "actor-1",
  createdAt: new Date("2026-08-28T00:00:00.000Z"),
  updatedAt: new Date("2026-08-28T00:00:00.000Z"),
  deletedAt: null,
  services: [],
  ...overrides,
});

describe("EventManagementService", () => {
  it("records EVENT_CREATED with actor, entity id and old/new changes", async () => {
    const input: CreateEventInput = {
      name: "Casamento de Alice",
      eventDate: new Date("2026-10-10T15:00:00.000Z"),
      endDate: null,
      location: "Salao Principal",
      serviceType: "CASAMENTO",
      guestsCount: 100,
      observations: null,
      createdById: "actor-1",
    };
    const events = {
      create: jest.fn(async (eventInput: CreateEventInput & { status: "PLANEJAMENTO" }) => makeEvent({ ...eventInput, status: "PLANEJAMENTO" })),
    } as unknown as EventRepository;
    const audit = { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) } as unknown as EventAuditService;
    const service = new EventManagementService(events, audit);

    const result = await service.create(input);

    expect(events.create).toHaveBeenCalledWith({ ...input, status: "PLANEJAMENTO" });
    expect(result.status).toBe("PLANEJAMENTO");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "EVENT_CREATED",
      entity: "Event",
      entityId: "event-1",
      userId: "actor-1",
      changes: {
        before: null,
        after: expect.objectContaining({ name: input.name, status: "PLANEJAMENTO" }),
      },
    }));
  });

  it("rejects creating an event above the maximum guest limit", async () => {
    const events = { create: jest.fn() } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.create({
      name: "Evento grande demais",
      eventDate: new Date("2026-10-10T15:00:00.000Z"),
      endDate: null,
      location: "Salao Principal",
      serviceType: "CASAMENTO",
      guestsCount: 5001,
      observations: null,
      createdById: "actor-1",
    })).rejects.toThrow("exceder");
    expect(events.create).not.toHaveBeenCalled();
  });

  it("gets an existing event and rejects a missing event", async () => {
    const event = makeEvent();
    const events = { findById: jest.fn(async (id: string) => id === "event-1" ? event : null) } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.get("event-1")).resolves.toEqual(event);
    await expect(service.get("missing")).rejects.toThrow("Evento não encontrado");
  });

  it("lists events using the repository filter", async () => {
    const events = { list: jest.fn(async () => [makeEvent()]) } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.list({ status: "PLANEJAMENTO" })).resolves.toHaveLength(1);
    expect(events.list).toHaveBeenCalledWith({ status: "PLANEJAMENTO" });
  });

  it("records EVENT_UPDATED with actor, entity id and old/new changes when editing fields", async () => {
    const event = makeEvent({ observations: null });
    const updated = makeEvent({ observations: "Menu atualizado" });
    const audit = { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) } as unknown as EventAuditService;
    const events = {
      findById: jest.fn(async () => event),
      update: jest.fn(async () => updated),
    } as unknown as EventRepository;
    const service = new EventManagementService(events, audit);

    await service.update("event-1", { observations: updated.observations }, "actor-1");

    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "EVENT_UPDATED",
      userId: "actor-1",
      entityId: "event-1",
      changes: { before: event, after: updated },
    }));
  });

  it("records EVENT_STATUS_CHANGED instead of EVENT_UPDATED when changing status", async () => {
    const event = makeEvent({ status: "PLANEJAMENTO" });
    const updated = makeEvent({ status: "CONFIRMADO" });
    const audit = { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) } as unknown as EventAuditService;
    const events = {
      findById: jest.fn(async () => event),
      update: jest.fn(async () => updated),
    } as unknown as EventRepository;
    const service = new EventManagementService(events, audit);

    await service.update("event-1", { status: "CONFIRMADO" }, "actor-1");

    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "EVENT_STATUS_CHANGED",
      userId: "actor-1",
      entityId: "event-1",
      changes: { before: event, after: updated },
    }));
    expect(audit.record).not.toHaveBeenCalledWith(expect.objectContaining({ action: "EVENT_UPDATED" }));
  });

  it("records EVENT_DELETED with actor, entity id and old/new changes on soft delete", async () => {
    const event = makeEvent({ status: "PLANEJAMENTO", deletedAt: null });
    const deleted = makeEvent({ status: "PLANEJAMENTO", deletedAt: new Date("2026-09-21T00:00:00.000Z") });
    const audit = { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) } as unknown as EventAuditService;
    const events = {
      findById: jest.fn(async () => event),
      softDelete: jest.fn(async () => deleted),
    } as unknown as EventRepository;
    const service = new EventManagementService(events, audit);

    await service.remove("event-1", "actor-1");

    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "EVENT_DELETED",
      userId: "actor-1",
      entityId: "event-1",
      changes: { before: event, after: deleted },
    }));
  });

  it("rejects updating guestsCount above the maximum limit", async () => {
    const event = makeEvent();
    const events = { findById: jest.fn(async () => event), update: jest.fn() } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.update("event-1", { guestsCount: 5001 }, "actor-1")).rejects.toThrow("exceder");
    expect(events.update).not.toHaveBeenCalled();
  });

  it.each([0, -1])("rejects an event with guestsCount=%i", async (guestsCount) => {
    const events = {
      create: jest.fn(),
    } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) } as unknown as EventAuditService);

    await expect(service.create({
      name: "Evento inválido",
      eventDate: new Date("2026-10-10T15:00:00.000Z"),
      endDate: null,
      location: "Salao Principal",
      serviceType: "CASAMENTO",
      guestsCount,
      observations: null,
      createdById: "actor-1",
    })).rejects.toThrow("convidados");
    expect(events.create).not.toHaveBeenCalled();
  });

  it("rejects creating an event with a past eventDate", async () => {
    const events = { create: jest.fn() } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.create({
      name: "Evento atrasado",
      eventDate: new Date("2020-01-01T15:00:00.000Z"),
      endDate: null,
      location: "Salao Principal",
      serviceType: "CASAMENTO",
      guestsCount: 100,
      observations: null,
      createdById: "actor-1",
    })).rejects.toThrow("passado");
    expect(events.create).not.toHaveBeenCalled();
  });

  it("allows updating an existing event to a past eventDate", async () => {
    const existing = makeEvent({ eventDate: new Date("2026-10-10T15:00:00.000Z") });
    const updated = makeEvent({ eventDate: new Date("2020-01-01T15:00:00.000Z") });
    const events = {
      findById: jest.fn(async () => existing),
      update: jest.fn(async () => updated),
    } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.update("event-1", { eventDate: updated.eventDate }, "actor-1")).resolves.toEqual(updated);
    expect(events.update).toHaveBeenCalledWith("event-1", { eventDate: updated.eventDate });
  });

  it("rejects cancelling a confirmed event without reason", async () => {
    const event = makeEvent({ status: "CONFIRMADO" });
    const events = { findById: jest.fn(async () => event), update: jest.fn() } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.update("event-1", { status: "CANCELADO" }, "actor-1")).rejects.toThrow("reason");
    expect(events.update).not.toHaveBeenCalled();
  });

  it("rejects cancelling an in-progress event without reason", async () => {
    const event = makeEvent({ status: "EM_ANDAMENTO" });
    const events = { findById: jest.fn(async () => event), update: jest.fn() } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.update("event-1", { status: "CANCELADO" }, "actor-1")).rejects.toThrow("reason");
    expect(events.update).not.toHaveBeenCalled();
  });

  it("rejects changing date or location of a confirmed event without reason", async () => {
    const event = makeEvent({ status: "CONFIRMADO" });
    const events = { findById: jest.fn(async () => event), update: jest.fn() } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.update("event-1", { location: "Salao Jardim" }, "actor-1")).rejects.toThrow("reason");
    expect(events.update).not.toHaveBeenCalled();
  });

  it("allows changing a non-date/location field of a confirmed event without reason", async () => {
    const event = makeEvent({ status: "CONFIRMADO" });
    const updated = makeEvent({ status: "CONFIRMADO", observations: "Menu atualizado" });
    const events = {
      findById: jest.fn(async () => event),
      update: jest.fn(async () => updated),
    } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.update("event-1", { observations: "Menu atualizado" }, "actor-1")).resolves.toEqual(updated);
    expect(events.update).toHaveBeenCalledWith("event-1", { observations: "Menu atualizado" });
  });

  it("rejects soft-deleting a completed event", async () => {
    const event = makeEvent({ status: "CONCLUIDO" });
    const events = { findById: jest.fn(async () => event), softDelete: jest.fn() } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.remove("event-1", "actor-1")).rejects.toThrow("concluídos");
    expect(events.softDelete).not.toHaveBeenCalled();
  });

  it.each(["PLANEJAMENTO", "CONFIRMADO", "EM_ANDAMENTO", "CANCELADO"] as const)(
    "soft-deletes an event with status %s",
    async (status) => {
      const event = makeEvent({ status });
      const deleted = makeEvent({ status, deletedAt: new Date("2026-09-21T00:00:00.000Z") });
      const events = {
        findById: jest.fn(async () => event),
        softDelete: jest.fn(async () => deleted),
      } as unknown as EventRepository;
      const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService);

      await expect(service.remove("event-1", "actor-1")).resolves.toEqual(deleted);
      expect(events.softDelete).toHaveBeenCalledWith("event-1");
    },
  );

  it("rejects a transition from a terminal status", async () => {
    const completed = makeEvent({ status: "CONCLUIDO" });
    const events = {
      findById: jest.fn(async () => completed),
      update: jest.fn(async () => completed),
    } as unknown as EventRepository;
    const service = new EventManagementService(events, { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) } as unknown as EventAuditService);

    await expect(service.update("event-1", { status: "PLANEJAMENTO" }, "actor-1"))
      .rejects.toThrow("transição de status inválida");
    expect(events.update).not.toHaveBeenCalled();
  });

  it("requires a custom label only for the custom catalog service", async () => {
    const events = {
      attachService: jest.fn(async () => makeEvent()),
    } as unknown as EventRepository;
    const services = {
      findById: jest.fn(async () => ({
        id: "service-other",
        name: "Outro",
        isCustom: true,
        createdAt: new Date(),
        deletedAt: null,
      })),
    } as unknown as ServiceRepository;
    const service = new EventManagementService(events, { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) } as unknown as EventAuditService, services);

    await expect(service.attachService({ eventId: "event-1", serviceId: "service-other" }, "actor-1"))
      .rejects.toThrow("customLabel");
    expect(events.attachService).not.toHaveBeenCalled();
  });

  it("rejects a custom label for a regular catalog service", async () => {
    const events = { attachService: jest.fn() } as unknown as EventRepository;
    const services = {
      findById: jest.fn(async () => ({ id: "service-1", name: "Buffet", isCustom: false, createdAt: new Date(), deletedAt: null })),
    } as unknown as ServiceRepository;
    const service = new EventManagementService(events, { record: jest.fn() } as unknown as EventAuditService, services);

    await expect(service.attachService({ eventId: "event-1", serviceId: "service-1", customLabel: "Nome indevido" }, "actor-1"))
      .rejects.toThrow("só pode");
    expect(events.attachService).not.toHaveBeenCalled();
  });

  it("attaches and detaches a service with dedicated audits", async () => {
    const events = {
      attachService: jest.fn(async () => makeEvent()),
      detachService: jest.fn(async () => undefined),
    } as unknown as EventRepository;
    const services = {
      findById: jest.fn(async () => ({ id: "service-1", name: "Buffet", isCustom: false, createdAt: new Date(), deletedAt: null })),
    } as unknown as ServiceRepository;
    const audit = { record: jest.fn() } as unknown as EventAuditService;
    const service = new EventManagementService(events, audit, services);

    await service.attachService({ eventId: "event-1", serviceId: "service-1" }, "actor-1");
    await service.detachService("event-1", "service-1", "actor-1");

    expect(events.attachService).toHaveBeenCalledWith({ eventId: "event-1", serviceId: "service-1", customLabel: null });
    expect(events.detachService).toHaveBeenCalledWith("event-1", "service-1");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "EVENT_SERVICE_ATTACHED" }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "EVENT_SERVICE_DETACHED" }));
  });

  it("records EVENT_RESTORED with actor, entity id and old/new changes", async () => {
    const deleted = makeEvent({ deletedAt: new Date("2026-09-20T00:00:00.000Z") });
    const restored = makeEvent({ deletedAt: null });
    const audit = { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) } as unknown as EventAuditService;
    const events = {
      findById: jest.fn(async () => deleted),
      restore: jest.fn(async () => restored),
    } as unknown as EventRepository;
    const service = new EventManagementService(events, audit);

    await service.restore("event-1", "actor-1");

    expect(events.restore).toHaveBeenCalledWith("event-1");
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "EVENT_RESTORED",
      userId: "actor-1",
      entityId: "event-1",
      changes: {
        before: { deletedAt: "set" },
        after: { deletedAt: null },
      },
    }));
  });
});