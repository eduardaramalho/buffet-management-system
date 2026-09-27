import { describe, expect, it, jest } from "@jest/globals";

import { PrismaEventTeamRepository } from "./PrismaEventTeamRepository.js";

describe("PrismaEventTeamRepository", () => {
  it("lists non-deleted events assigned to a team for conflict checks", async () => {
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaEventTeamRepository({ event: { findMany } } as never);

    await repository.listEventsByTeam("team-1");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        deletedAt: null,
        teams: { some: { teamId: "team-1" } },
      },
      select: expect.objectContaining({ eventDate: true, endDate: true, status: true }),
    }));
  });

  it("creates an assignment with the actor and supports listing by event", async () => {
    const create = jest.fn(async (_input: unknown) => ({ eventId: "event-1", teamId: "team-1", assignedAt: new Date(), assignedById: "actor-1" }));
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaEventTeamRepository({ eventTeam: { create, findMany } } as never);

    await repository.assign("event-1", "team-1", "actor-1");
    await repository.listTeamsByEvent("event-1");

    expect(create).toHaveBeenCalledWith({ data: { eventId: "event-1", teamId: "team-1", assignedById: "actor-1" } });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: "event-1" } }));
  });

  it("finds scheduling records for an event and a team", async () => {
    const eventFindFirst = jest.fn(async (_input: unknown) => null);
    const teamFindFirst = jest.fn(async (_input: unknown) => null);
    const repository = new PrismaEventTeamRepository({
      event: { findFirst: eventFindFirst },
      team: { findFirst: teamFindFirst },
    } as never);

    await repository.findEventById("event-1");
    await repository.findTeamById("team-1");

    expect(eventFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "event-1", deletedAt: null } }));
    expect(teamFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "team-1", deletedAt: null } }));
  });

  it("unassigns a team and lists assignments filtering out deleted events", async () => {
    const eventTeamDelete = jest.fn(async (_input: unknown) => undefined);
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaEventTeamRepository({ eventTeam: { delete: eventTeamDelete, findMany } } as never);

    await repository.unassign("event-1", "team-1");
    await repository.listAssignmentsByTeam("team-1");

    expect(eventTeamDelete).toHaveBeenCalledWith({ where: { eventId_teamId: { eventId: "event-1", teamId: "team-1" } } });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { teamId: "team-1", event: { deletedAt: null } },
    }));
  });
});
