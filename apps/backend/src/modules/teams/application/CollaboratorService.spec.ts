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