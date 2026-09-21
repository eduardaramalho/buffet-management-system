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
  it("creates an event with planning status and records audit", async () => {
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
    }));
  });

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

  it("restores a soft-deleted event and records audit", async () => {
    const events = {
      restore: jest.fn(async () => makeEvent({ deletedAt: null })),
    } as unknown as EventRepository;
    const audit = { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) } as unknown as EventAuditService;
    const service = new EventManagementService(events, audit);

    await service.restore("event-1", "actor-1");

    expect(events.restore).toHaveBeenCalledWith("event-1");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "EVENT_RESTORED" }));
  });
});