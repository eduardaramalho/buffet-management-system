import { describe, expect, it, jest } from "@jest/globals";

import { PrismaTeamRepository } from "./PrismaTeamRepository.js";

describe("PrismaTeamRepository", () => {
  it("lists only non-deleted teams with their members", async () => {
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaTeamRepository({
      team: { findMany },
    } as never);

    await repository.list({ status: "ATIVA", search: "Cozinha" });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: null, status: "ATIVA" }),
      include: expect.any(Object),
    }));
  });

  it("finds active collaborators without exposing deleted records", async () => {
    const findFirst = jest.fn(async (_input: unknown) => null);
    const repository = new PrismaTeamRepository({
      team: { findFirst },
      collaborator: { findFirst },
    } as never);

    await repository.findById("team-1");
    await repository.findCollaboratorById("collaborator-1");

    expect(findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: "team-1", deletedAt: null } }));
    expect(findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: "collaborator-1", deletedAt: null } }));
  });
});
