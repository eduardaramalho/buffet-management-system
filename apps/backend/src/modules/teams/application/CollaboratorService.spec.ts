import { describe, expect, it, jest } from "@jest/globals";

import { CollaboratorService } from "./CollaboratorService.js";
import type { AuditService, CollaboratorRecord, CollaboratorRepository } from "../domain/team.types.js";

const makeCollaborator = (overrides: Partial<CollaboratorRecord> = {}): CollaboratorRecord => ({
  id: "collaborator-1",
  name: "Ana Silva",
  phone: "11999999999",
  position: "Cozinheira",
  status: "ATIVO",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe("CollaboratorService", () => {
  it("lists and gets a collaborator", async () => {
    const collaborator = makeCollaborator();
    const collaborators = {
      list: jest.fn(async () => [collaborator]),
      findById: jest.fn(async () => collaborator),
    } as unknown as CollaboratorRepository;
    const service = new CollaboratorService(collaborators, { record: jest.fn() } as unknown as AuditService);

    await expect(service.list({ search: "Ana" })).resolves.toEqual([collaborator]);
    await expect(service.get("collaborator-1")).resolves.toEqual(collaborator);
  });

  it("rejects getting a missing collaborator", async () => {
    const collaborators = { findById: jest.fn(async () => null) } as unknown as CollaboratorRepository;
    const service = new CollaboratorService(collaborators, { record: jest.fn() } as unknown as AuditService);

    await expect(service.get("missing")).rejects.toThrow("Colaborador não encontrado");
  });
  it("creates a valid collaborator and records audit", async () => {
    const collaborators = {
      create: jest.fn(async (input: { name: string; phone: string | null; position: string }) => makeCollaborator(input)),
    } as unknown as CollaboratorRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new CollaboratorService(collaborators, audit);

    const result = await service.create({ name: " Ana Silva ", phone: "11999999999", position: "Cozinheira" }, "actor-1");

    expect(collaborators.create).toHaveBeenCalledWith({ name: "Ana Silva", phone: "11999999999", position: "Cozinheira" });
    expect(result.name).toBe("Ana Silva");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "COLLABORATOR_CREATED" }));
  });

  it("rejects an empty name", async () => {
    const collaborators = { create: jest.fn() } as unknown as CollaboratorRepository;
    const service = new CollaboratorService(collaborators, { record: jest.fn() } as unknown as AuditService);

    await expect(service.create({ name: " ", phone: null, position: "Garçom" }, "actor-1")).rejects.toThrow("nome");
    expect(collaborators.create).not.toHaveBeenCalled();
  });

  it("rejects an empty position", async () => {
    const collaborators = { create: jest.fn() } as unknown as CollaboratorRepository;
    const service = new CollaboratorService(collaborators, { record: jest.fn() } as unknown as AuditService);

    await expect(service.create({ name: "Ana", phone: null, position: " " }, "actor-1")).rejects.toThrow("função");
    expect(collaborators.create).not.toHaveBeenCalled();
  });

  it("updates a collaborator and records audit", async () => {
    const collaborator = makeCollaborator();
    const updated = makeCollaborator({ name: "Ana Souza" });
    const collaborators = {
      findById: jest.fn(async () => collaborator),
      update: jest.fn(async () => updated),
    } as unknown as CollaboratorRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new CollaboratorService(collaborators, audit);

    await service.update("collaborator-1", { name: " Ana Souza " }, "actor-1");

    expect(collaborators.update).toHaveBeenCalledWith("collaborator-1", { name: "Ana Souza", position: undefined });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "COLLABORATOR_UPDATED", entityId: "collaborator-1" }));
  });

  it("updates only the position of a collaborator", async () => {
    const collaborator = makeCollaborator();
    const updated = makeCollaborator({ position: "Garçom" });
    const collaborators = {
      findById: jest.fn(async () => collaborator),
      update: jest.fn(async () => updated),
    } as unknown as CollaboratorRepository;
    const service = new CollaboratorService(collaborators, { record: jest.fn() } as unknown as AuditService);

    await service.update("collaborator-1", { position: " Garçom " }, "actor-1");

    expect(collaborators.update).toHaveBeenCalledWith("collaborator-1", { name: undefined, position: "Garçom" });
  });

  it("rejects updating to an empty name", async () => {
    const collaborators = {
      findById: jest.fn(async () => makeCollaborator()),
      update: jest.fn(),
    } as unknown as CollaboratorRepository;
    const service = new CollaboratorService(collaborators, { record: jest.fn() } as unknown as AuditService);

    await expect(service.update("collaborator-1", { name: "   " }, "actor-1")).rejects.toThrow("nome");
    expect(collaborators.update).not.toHaveBeenCalled();
  });

  it("rejects updating to an empty position", async () => {
    const collaborators = {
      findById: jest.fn(async () => makeCollaborator()),
      update: jest.fn(),
    } as unknown as CollaboratorRepository;
    const service = new CollaboratorService(collaborators, { record: jest.fn() } as unknown as AuditService);

    await expect(service.update("collaborator-1", { position: "   " }, "actor-1")).rejects.toThrow("função");
    expect(collaborators.update).not.toHaveBeenCalled();
  });

  it("lists collaborators with the default filter", async () => {
    const list = jest.fn(async () => []);
    const collaborators = { list } as unknown as CollaboratorRepository;
    const service = new CollaboratorService(collaborators, { record: jest.fn() } as unknown as AuditService);

    await service.list();

    expect(list).toHaveBeenCalledWith({});
  });

  it("changes status without physical deletion", async () => {
    const collaborators = {
      findById: jest.fn(async () => makeCollaborator()),
      setStatus: jest.fn(async () => makeCollaborator({ status: "INATIVO" })),
    } as unknown as CollaboratorRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new CollaboratorService(collaborators, audit);

    const result = await service.setActive("collaborator-1", false, "actor-1");

    expect(collaborators.setStatus).toHaveBeenCalledWith("collaborator-1", "INATIVO");
    expect(result.status).toBe("INATIVO");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "COLLABORATOR_STATUS_CHANGED" }));
  });
});