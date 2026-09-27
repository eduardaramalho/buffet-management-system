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

  it("lists all active teams when no extra filters are given", async () => {
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaTeamRepository({ team: { findMany } } as never);

    await repository.list({});

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deletedAt: null },
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

  it("creates, updates, soft-deletes and changes status of a team", async () => {
    const create = jest.fn(async (_input: unknown) => ({}));
    const update = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaTeamRepository({ team: { create, update } } as never);

    await repository.create({ name: "Equipe A", specialty: "COZINHA", observations: null, createdById: "actor-1" });
    await repository.update("team-1", { name: "Equipe B" });
    await repository.softDelete("team-1");
    await repository.setStatus("team-1", "INATIVA");

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: "Equipe A" }) }));
    expect(update).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: "team-1" }, data: { name: "Equipe B" } }));
    expect(update).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }));
    expect(update).toHaveBeenNthCalledWith(3, expect.objectContaining({ data: { status: "INATIVA" } }));
  });

  it("adds and removes a team member", async () => {
    const teamMemberCreate = jest.fn(async (_input: unknown) => ({}));
    const teamMemberDelete = jest.fn(async (_input: unknown) => ({}));
    const findFirstOrThrow = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaTeamRepository({
      teamMember: { create: teamMemberCreate, delete: teamMemberDelete },
      team: { findFirstOrThrow },
    } as never);

    await repository.addMember("team-1", "collaborator-1", true);
    await repository.removeMember("team-1", "collaborator-1");

    expect(teamMemberCreate).toHaveBeenCalledWith({ data: { teamId: "team-1", collaboratorId: "collaborator-1", isLeader: true } });
    expect(findFirstOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "team-1", deletedAt: null } }));
    expect(teamMemberDelete).toHaveBeenCalledWith({ where: { teamId_collaboratorId: { teamId: "team-1", collaboratorId: "collaborator-1" } } });
  });
});
