import { describe, expect, it, jest } from "@jest/globals";

import { ServiceCatalogService } from "./ServiceCatalogService.js";
import type { ServiceRepository, EventAuditService } from "../domain/event.types.js";

describe("ServiceCatalogService", () => {
  it("lists and gets an existing catalog service", async () => {
    const serviceRecord = { id: "service-1", name: "Fotografia", isCustom: false, createdAt: new Date(), deletedAt: null };
    const repository = {
      list: jest.fn(async () => [serviceRecord]),
      findById: jest.fn(async () => serviceRecord),
    } as unknown as ServiceRepository;
    const service = new ServiceCatalogService(repository, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.list()).resolves.toEqual([serviceRecord]);
    await expect(service.get("service-1")).resolves.toEqual(serviceRecord);
  });

  it("rejects getting a missing catalog service", async () => {
    const repository = { findById: jest.fn(async () => null) } as unknown as ServiceRepository;
    const service = new ServiceCatalogService(repository, { record: jest.fn() } as unknown as EventAuditService);

    await expect(service.get("missing")).rejects.toThrow("Serviço não encontrado");
  });
  it("creates a catalog service and records audit", async () => {
    const repository = {
      create: jest.fn(async (input: { name: string; isCustom: boolean }) => ({
        id: "service-1",
        ...input,
        createdAt: new Date(),
        deletedAt: null,
      })),
    } as unknown as ServiceRepository;
    const audit = { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) } as unknown as EventAuditService;
    const service = new ServiceCatalogService(repository, audit);

    const result = await service.create({ name: "Fotografia", isCustom: false }, "actor-1");

    expect(repository.create).toHaveBeenCalledWith({ name: "Fotografia", isCustom: false });
    expect(result.name).toBe("Fotografia");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "SERVICE_CREATED",
      entity: "Service",
      entityId: "service-1",
      userId: "actor-1",
    }));
  });

  it("updates and soft-deletes a catalog service with audits", async () => {
    const updated = { id: "service-1", name: "Fotografia 2", isCustom: false, createdAt: new Date(), deletedAt: null };
    const repository = {
      update: jest.fn(async () => updated),
      softDelete: jest.fn(async () => ({ ...updated, deletedAt: new Date() })),
    } as unknown as ServiceRepository;
    const audit = { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) } as unknown as EventAuditService;
    const service = new ServiceCatalogService(repository, audit);

    await service.update("service-1", { name: "Fotografia 2" }, "actor-1");
    await service.remove("service-1", "actor-1");

    expect(repository.update).toHaveBeenCalledWith("service-1", { name: "Fotografia 2" });
    expect(repository.softDelete).toHaveBeenCalledWith("service-1");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "SERVICE_UPDATED", entityId: "service-1" }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "SERVICE_DELETED", entityId: "service-1" }));
  });
});