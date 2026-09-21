import { describe, expect, it, jest } from "@jest/globals";
import { PrismaEventTeamRepository } from "./PrismaEventTeamRepository.js";
describe("PrismaEventTeamRepository", () => {
    it("lists non-deleted events assigned to a team for conflict checks", async () => {
        const findMany = jest.fn(async (_input) => []);
        const repository = new PrismaEventTeamRepository({ event: { findMany } });
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
        const create = jest.fn(async (_input) => ({ eventId: "event-1", teamId: "team-1", assignedAt: new Date(), assignedById: "actor-1" }));
        const findMany = jest.fn(async (_input) => []);
        const repository = new PrismaEventTeamRepository({ eventTeam: { create, findMany } });
        await repository.assign("event-1", "team-1", "actor-1");
        await repository.listTeamsByEvent("event-1");
        expect(create).toHaveBeenCalledWith({ data: { eventId: "event-1", teamId: "team-1", assignedById: "actor-1" } });
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: "event-1" } }));
    });
});
