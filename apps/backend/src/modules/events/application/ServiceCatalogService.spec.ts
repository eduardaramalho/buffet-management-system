import { describe, expect, it, jest } from "@jest/globals";

import { ServiceCatalogConflictError, ServiceCatalogError, ServiceCatalogService } from "./ServiceCatalogService.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import type { EventAuditService, ServiceRecord, ServiceRepository } from "../domain/event.types.js";

const makeService = (overrides: Partial<ServiceRecord> = {}): ServiceRecord => ({
  id: "service-1", name: "Fotografia", isCustom: false, createdAt: new Date("2026-10-01T00:00:00.000Z"), deletedAt: null, ...overrides,
});

const build = (options: { existing?: ServiceRecord | null; sameName?: ServiceRecord | null; custom?: ServiceRecord | null } = {}) => {
  const existing = options.existing === undefined ? makeService() : options.existing;
  const repository = {
    list: jest.fn(async () => [makeService()]),
    findById: jest.fn(async (_id: string) => existing),
    findActiveByName: jest.fn(async (_name: string, _excludeId?: string) => options.sameName ?? null),
    findActiveCustom: jest.fn(async () => options.custom ?? null),
    create: jest.fn(async (input: { name: string; isCustom: boolean }) => makeService({ id: "service-new", ...input })),
    update: jest.fn(async (id: string, input: { name?: string }) => makeService({ ...existing, id, ...input })),
    softDelete: jest.fn(async (id: string) => makeService({ ...existing, id, deletedAt: new Date() })),
  };
  const audit = { record: jest.fn(async (_input: Parameters<EventAuditService["record"]>[0]) => undefined) };
  const service = new ServiceCatalogService(repository as unknown as ServiceRepository, audit as unknown as EventAuditService);
  return { service, repository, audit };
};

describe("ServiceCatalogService (RF06)", () => {
  it("lists the active catalog and gets one service", async () => {
    const { service } = build();

    await expect(service.list()).resolves.toEqual([makeService()]);
    await expect(service.get("service-1")).resolves.toEqual(makeService());
  });

  it("answers NotFoundError (404) for a missing or removed service on get, update and remove", async () => {
    const { service, repository } = build({ existing: null });

    await expect(service.get("missing")).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.update("missing", { name: "X" }, "actor-1")).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.remove("missing", "actor-1")).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  describe("create", () => {
    it("creates a regular service with the trimmed name and audits it", async () => {
      const { service, repository, audit } = build();

      const created = await service.create({ name: "  Fotografia  ", isCustom: false }, "actor-1");

      expect(repository.findActiveByName).toHaveBeenCalledWith("Fotografia");
      expect(repository.create).toHaveBeenCalledWith({ name: "Fotografia", isCustom: false });
      expect(created.id).toBe("service-new");
      expect(audit.record).toHaveBeenCalledWith({ userId: "actor-1", action: "SERVICE_CREATED", entity: "Service", entityId: "service-new", changes: { name: "Fotografia", isCustom: false } });
    });

    it("rejects a name already used by an active service with a conflict (409)", async () => {
      const { service, repository } = build({ sameName: makeService({ id: "service-2", name: "fotografia" }) });

      await expect(service.create({ name: "Fotografia", isCustom: false }, "actor-1")).rejects.toThrow(new ServiceCatalogConflictError("Já existe um serviço com este nome"));
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects a blank name", async () => {
      const { service } = build();

      await expect(service.create({ name: "   ", isCustom: false }, "actor-1")).rejects.toThrow(new ServiceCatalogError("Informe o nome do serviço"));
    });

    it("allows only one active generic service (ADR 0001)", async () => {
      const { service, repository } = build({ custom: makeService({ id: "service-outro", name: "Outro", isCustom: true }) });

      await expect(service.create({ name: "Outro 2", isCustom: true }, "actor-1")).rejects.toThrow(new ServiceCatalogConflictError("O catálogo já tem o serviço genérico Outro"));
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("creates the generic service when the catalog has none", async () => {
      const { service, repository } = build({ custom: null });

      await service.create({ name: "Outro", isCustom: true }, "actor-1");

      expect(repository.create).toHaveBeenCalledWith({ name: "Outro", isCustom: true });
    });
  });

  describe("update", () => {
    it("renames a service, ignoring itself in the uniqueness check, and audits before and after", async () => {
      const { service, repository, audit } = build();

      await service.update("service-1", { name: " Fotografia e vídeo " }, "actor-1");

      expect(repository.findActiveByName).toHaveBeenCalledWith("Fotografia e vídeo", "service-1");
      expect(repository.update).toHaveBeenCalledWith("service-1", { name: "Fotografia e vídeo" });
      expect(audit.record).toHaveBeenCalledWith({
        userId: "actor-1", action: "SERVICE_UPDATED", entity: "Service", entityId: "service-1",
        changes: { name: "Fotografia e vídeo", before: { name: "Fotografia" }, after: { name: "Fotografia e vídeo" } },
      });
    });

    it("rejects renaming to a name already in use", async () => {
      const { service, repository } = build({ sameName: makeService({ id: "service-2", name: "Bar" }) });

      await expect(service.update("service-1", { name: "Bar" }, "actor-1")).rejects.toBeInstanceOf(ServiceCatalogConflictError);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("never changes whether a service is generic, which would break the labels of contracted events", async () => {
      const regular = build();
      const generic = build({ existing: makeService({ id: "service-outro", name: "Outro", isCustom: true }) });

      await expect(regular.service.update("service-1", { isCustom: true }, "actor-1")).rejects.toThrow(new ServiceCatalogError("O tipo do serviço não pode ser alterado"));
      await expect(generic.service.update("service-outro", { isCustom: false }, "actor-1")).rejects.toThrow(new ServiceCatalogError("O tipo do serviço não pode ser alterado"));
      await expect(regular.service.update("service-1", { name: "Foto", isCustom: false }, "actor-1")).resolves.toBeDefined();
    });

    it("lets the generic service be renamed", async () => {
      const { service, repository } = build({ existing: makeService({ id: "service-outro", name: "Outro", isCustom: true }) });

      await service.update("service-outro", { name: "Outros serviços" }, "actor-1");

      expect(repository.update).toHaveBeenCalledWith("service-outro", { name: "Outros serviços" });
    });

    it("skips the uniqueness check when the name is not sent", async () => {
      const { service, repository } = build();

      await service.update("service-1", {}, "actor-1");

      expect(repository.findActiveByName).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith("service-1", {});
    });
  });

  describe("remove", () => {
    it("soft-deletes a regular service, even if events contracted it, and audits its name", async () => {
      const { service, repository, audit } = build();

      await service.remove("service-1", "actor-1");

      expect(repository.softDelete).toHaveBeenCalledWith("service-1");
      expect(audit.record).toHaveBeenCalledWith({ userId: "actor-1", action: "SERVICE_DELETED", entity: "Service", entityId: "service-1", changes: { name: "Fotografia" } });
    });

    it("protects the generic service from removal", async () => {
      const { service, repository } = build({ existing: makeService({ id: "service-outro", name: "Outro", isCustom: true }) });

      await expect(service.remove("service-outro", "actor-1")).rejects.toThrow(new ServiceCatalogError("O serviço genérico Outro não pode ser excluído"));
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});