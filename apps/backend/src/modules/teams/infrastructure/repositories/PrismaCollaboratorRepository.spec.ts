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

  it("changes status with update instead of deleting", async () => {
    const update = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaCollaboratorRepository({ collaborator: { update } } as never);

    await repository.setStatus("collaborator-1", "INATIVO");

    expect(update).toHaveBeenCalledWith({ where: { id: "collaborator-1" }, data: { status: "INATIVO" } });
  });
});
