import { describe, expect, it, jest } from "@jest/globals";

import { PrismaCollaboratorRepository } from "./PrismaCollaboratorRepository.js";

describe("PrismaCollaboratorRepository", () => {
  it("lists active records using a name search and soft-delete filter", async () => {
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaCollaboratorRepository({ collaborator: { findMany } } as never);

    await repository.list({ search: "Ana" });

    expect(findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, name: { contains: "Ana" } },
      orderBy: { name: "asc" },
    });
  });

  it("lists all active records when no search filter is given", async () => {
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaCollaboratorRepository({ collaborator: { findMany } } as never);

    await repository.list({});

    expect(findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
  });

  it("changes status with update instead of deleting", async () => {
    const update = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaCollaboratorRepository({ collaborator: { update } } as never);

    await repository.setStatus("collaborator-1", "INATIVO");

    expect(update).toHaveBeenCalledWith({ where: { id: "collaborator-1" }, data: { status: "INATIVO" } });
  });

  it("finds an active collaborator by id without exposing deleted records", async () => {
    const findFirst = jest.fn(async (_input: unknown) => null);
    const repository = new PrismaCollaboratorRepository({ collaborator: { findFirst } } as never);

    await repository.findById("collaborator-1");

    expect(findFirst).toHaveBeenCalledWith({ where: { id: "collaborator-1", deletedAt: null } });
  });

  it("creates and updates a collaborator", async () => {
    const create = jest.fn(async (_input: unknown) => ({}));
    const update = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaCollaboratorRepository({ collaborator: { create, update } } as never);

    await repository.create({ name: "Ana", phone: null, position: "Cozinheira" });
    await repository.update("collaborator-1", { name: "Ana Souza" });

    expect(create).toHaveBeenCalledWith({ data: { name: "Ana", phone: null, position: "Cozinheira" } });
    expect(update).toHaveBeenCalledWith({ where: { id: "collaborator-1" }, data: { name: "Ana Souza" } });
  });
});
