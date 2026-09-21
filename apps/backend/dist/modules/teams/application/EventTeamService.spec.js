import { describe, expect, it, jest } from "@jest/globals";
import { EventTeamService } from "./EventTeamService.js";
const makeEvent = (overrides = {}) => ({
    id: "event-1",
    eventDate: new Date("2026-10-10T15:00:00.000Z"),
    endDate: new Date("2026-10-10T22:00:00.000Z"),
    status: "PLANEJAMENTO",
    deletedAt: null,
    ...overrides,
});
const makeTeam = (overrides = {}) => ({
    id: "team-1",
    status: "ATIVA",
    deletedAt: null,
    ...overrides,
});
describe("EventTeamService", () => {
    it("assigns an active team to an event in planning and records audit", async () => {
        const eventTeams = {
            findEventById: jest.fn(async () => makeEvent()),
            findTeamById: jest.fn(async () => makeTeam()),
            listEventsByTeam: jest.fn(async () => []),
            assign: jest.fn(async () => ({
                eventId: "event-1",
                teamId: "team-1",
                assignedAt: new Date(),
                assignedById: "actor-1",
            })),
        };
        const audit = { record: jest.fn() };
        const service = new EventTeamService(eventTeams, audit);
        await service.assignTeamToEvent("event-1", "team-1", "actor-1");
        expect(eventTeams.assign).toHaveBeenCalledWith("event-1", "team-1", "actor-1");
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
            action: "TEAM_ASSIGNED_TO_EVENT",
            entity: "Event",
            entityId: "event-1",
        }));
    });
    it("rejects assignment when the team already occupies the full day", async () => {
        const eventTeams = {
            findEventById: jest.fn(async () => makeEvent()),
            findTeamById: jest.fn(async () => makeTeam()),
            listEventsByTeam: jest.fn(async () => [makeEvent({
                    id: "event-2",
                    eventDate: new Date("2026-10-10T00:00:00.000Z"),
                    endDate: null,
                })]),
            assign: jest.fn(),
        };
        const service = new EventTeamService(eventTeams, { record: jest.fn() });
        await expect(service.assignTeamToEvent("event-1", "team-1", "actor-1"))
            .rejects.toThrow("conflito");
        expect(eventTeams.assign).not.toHaveBeenCalled();
    });
    it("rejects assignment to an inactive team or terminal event", async () => {
        const eventTeams = {
            findEventById: jest.fn(async () => makeEvent({ status: "CONCLUIDO" })),
            findTeamById: jest.fn(async () => makeTeam({ status: "INATIVA" })),
            listEventsByTeam: jest.fn(async () => []),
            assign: jest.fn(),
        };
        const service = new EventTeamService(eventTeams, { record: jest.fn() });
        await expect(service.assignTeamToEvent("event-1", "team-1", "actor-1"))
            .rejects.toThrow("concluído");
        expect(eventTeams.assign).not.toHaveBeenCalled();
    });
});
