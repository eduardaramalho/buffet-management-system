import { describe, expect, it, jest } from "@jest/globals";
import { TeamService } from "./TeamService.js";
const makeTeam = (overrides = {}) => ({
    id: "team-1",
    name: "Equipe Cozinha A",
    specialty: "COZINHA",
    status: "ATIVA",
    observations: null,
    createdById: "actor-1",
    createdAt: new Date("2026-09-07T00:00:00.000Z"),
    updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    deletedAt: null,
    members: [],
    events: [],
    ...overrides,
});
describe("TeamService", () => {
    it("creates a valid reusable team and records audit", async () => {
        const input = {
            name: "Equipe Cozinha A",
            specialty: "COZINHA",
            observations: null,
            createdById: "actor-1",
        };
        const teams = {
            create: jest.fn(async (teamInput) => makeTeam(teamInput)),
        };
        const audit = { record: jest.fn(async (_input) => undefined) };
        const service = new TeamService(teams, audit);
        const result = await service.create(input);
        expect(teams.create).toHaveBeenCalledWith(input);
        expect(result.name).toBe("Equipe Cozinha A");
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
            action: "TEAM_CREATED",
            entity: "Team",
            entityId: "team-1",
            userId: "actor-1",
        }));
    });
    it("rejects a team with an empty name", async () => {
        const teams = { create: jest.fn() };
        const service = new TeamService(teams, { record: jest.fn() });
        await expect(service.create({
            name: "   ",
            specialty: "COZINHA",
            observations: null,
            createdById: "actor-1",
        })).rejects.toThrow("nome");
        expect(teams.create).not.toHaveBeenCalled();
    });
    it("allows a collaborator to belong to multiple teams", async () => {
        const collaborator = {
            id: "collaborator-1",
            name: "Ana",
            phone: null,
            position: "Cozinheira",
            status: "ATIVO",
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
        };
        const teams = {
            findById: jest.fn(async () => makeTeam()),
            addMember: jest.fn(async () => makeTeam()),
        };
        const collaborators = { findById: jest.fn(async () => collaborator) };
        const service = new TeamService(teams, { record: jest.fn() }, collaborators);
        await service.addMember("team-1", "collaborator-1", false, "actor-1");
        expect(teams.addMember).toHaveBeenCalledWith("team-1", "collaborator-1", false);
    });
    it("rejects adding a second leader to the same team", async () => {
        const teams = {
            findById: jest.fn(async () => makeTeam({
                members: [{
                        collaboratorId: "leader-1",
                        isLeader: true,
                        collaborator: {
                            id: "leader-1",
                            name: "Lia",
                            phone: null,
                            position: "Coordenadora",
                            status: "ATIVO",
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            deletedAt: null,
                        },
                    }],
            })),
            addMember: jest.fn(),
        };
        const collaborators = { findById: jest.fn(async () => ({
                id: "collaborator-2",
                name: "Bia",
                phone: null,
                position: "Garconete",
                status: "ATIVO",
                deletedAt: null,
            })) };
        const service = new TeamService(teams, { record: jest.fn() }, collaborators);
        await expect(service.addMember("team-1", "collaborator-2", true, "actor-1"))
            .rejects.toThrow("líder");
        expect(teams.addMember).not.toHaveBeenCalled();
    });
    it("deactivates a team without deleting its existing membership", async () => {
        const teams = {
            findById: jest.fn(async () => makeTeam()),
            setStatus: jest.fn(async () => makeTeam({ status: "INATIVA" })),
        };
        const audit = { record: jest.fn() };
        const service = new TeamService(teams, audit);
        const result = await service.setActive("team-1", false, "actor-1");
        expect(teams.setStatus).toHaveBeenCalledWith("team-1", "INATIVA");
        expect(result.status).toBe("INATIVA");
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "TEAM_UPDATED" }));
    });
});
