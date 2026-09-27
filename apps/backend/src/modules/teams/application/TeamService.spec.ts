import { describe, expect, it, jest } from "@jest/globals";

import { TeamService } from "./TeamService.js";
import type { AuditService, CollaboratorRecord, CollaboratorRepository, CreateTeamInput, TeamRepository, TeamRecord } from "../domain/team.types.js";

const makeTeam = (overrides: Partial<TeamRecord> = {}): TeamRecord => ({
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
  it("lists and gets an existing team", async () => {
    const team = makeTeam();
    const teams = {
      list: jest.fn(async () => [team]),
      findById: jest.fn(async () => team),
    } as unknown as TeamRepository;
    const service = new TeamService(teams, { record: jest.fn() } as unknown as AuditService);

    await expect(service.list({ status: "ATIVA" })).resolves.toEqual([team]);
    await expect(service.get("team-1")).resolves.toEqual(team);
  });

  it("rejects getting a missing team", async () => {
    const teams = { findById: jest.fn(async () => null) } as unknown as TeamRepository;
    const service = new TeamService(teams, { record: jest.fn() } as unknown as AuditService);

    await expect(service.get("missing")).rejects.toThrow("Equipe não encontrada");
  });
  it("creates a valid reusable team and records audit", async () => {
    const input: CreateTeamInput = {
      name: "Equipe Cozinha A",
      specialty: "COZINHA",
      observations: null,
      createdById: "actor-1",
    };
    const teams = {
      create: jest.fn(async (teamInput: CreateTeamInput) => makeTeam(teamInput)),
    } as unknown as TeamRepository;
    const audit = { record: jest.fn(async (_input: Parameters<AuditService["record"]>[0]) => undefined) } as unknown as AuditService;
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
    const teams = { create: jest.fn() } as unknown as TeamRepository;
    const service = new TeamService(teams, { record: jest.fn() } as unknown as AuditService);

    await expect(service.create({
      name: "   ",
      specialty: "COZINHA",
      observations: null,
      createdById: "actor-1",
    })).rejects.toThrow("nome");
    expect(teams.create).not.toHaveBeenCalled();
  });

  it("rejects updating to an empty name", async () => {
    const teams = {
      findById: jest.fn(async () => makeTeam()),
      update: jest.fn(),
    } as unknown as TeamRepository;
    const service = new TeamService(teams, { record: jest.fn() } as unknown as AuditService);

    await expect(service.update("team-1", { name: "   " }, "actor-1")).rejects.toThrow("nome");
    expect(teams.update).not.toHaveBeenCalled();
  });

  it("rejects adding a missing or deleted collaborator", async () => {
    const teams = {
      findById: jest.fn(async () => makeTeam()),
      addMember: jest.fn(),
    } as unknown as TeamRepository;
    const collaborators = { findById: jest.fn(async () => null) } as unknown as CollaboratorRepository;
    const service = new TeamService(teams, { record: jest.fn() } as unknown as AuditService, collaborators);

    await expect(service.addMember("team-1", "missing", false, "actor-1")).rejects.toThrow("inativo");

    const deletedCollaborators = { findById: jest.fn(async () => ({ status: "ATIVO", deletedAt: new Date() })) } as never;
    const serviceWithDeleted = new TeamService(teams, { record: jest.fn() } as unknown as AuditService, deletedCollaborators);

    await expect(serviceWithDeleted.addMember("team-1", "collaborator-1", false, "actor-1")).rejects.toThrow("inativo");
    expect(teams.addMember).not.toHaveBeenCalled();
  });

  it("updates and soft-deletes a team with audits", async () => {
    const team = makeTeam();
    const updated = makeTeam({ name: "Equipe Cozinha B" });
    const teams = {
      findById: jest.fn(async () => team),
      update: jest.fn(async () => updated),
      softDelete: jest.fn(async () => updated),
    } as unknown as TeamRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new TeamService(teams, audit);

    await service.update("team-1", { name: "Equipe Cozinha B" }, "actor-1");
    await service.remove("team-1", "actor-1");

    expect(teams.update).toHaveBeenCalledWith("team-1", { name: "Equipe Cozinha B" });
    expect(teams.softDelete).toHaveBeenCalledWith("team-1");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "TEAM_UPDATED" }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "TEAM_DELETED" }));
  });

  it("activates and deactivates a team", async () => {
    const team = makeTeam();
    const teams = {
      findById: jest.fn(async () => team),
      setStatus: jest.fn(async (_id: string, status: "ATIVA" | "INATIVA") => makeTeam({ status })),
    } as unknown as TeamRepository;
    const service = new TeamService(teams, { record: jest.fn() } as unknown as AuditService);

    await service.setActive("team-1", true, "actor-1");
    await service.setActive("team-1", false, "actor-1");

    expect(teams.setStatus).toHaveBeenNthCalledWith(1, "team-1", "ATIVA");
    expect(teams.setStatus).toHaveBeenNthCalledWith(2, "team-1", "INATIVA");
  });

  it("rejects adding a member when collaborators are not configured", async () => {
    const teams = { findById: jest.fn(async () => makeTeam()) } as unknown as TeamRepository;
    const service = new TeamService(teams, { record: jest.fn() } as unknown as AuditService);

    await expect(service.addMember("team-1", "collaborator-1", false, "actor-1")).rejects.toThrow("não configurados");
  });

  it("rejects adding a duplicate member or inactive collaborator", async () => {
    const teams = {
      findById: jest.fn(async () => makeTeam({ members: [{ collaboratorId: "collaborator-1", isLeader: false, collaborator: {} as never }] })),
      addMember: jest.fn(),
    } as unknown as TeamRepository;
    const collaborators = { findById: jest.fn(async () => ({ status: "INATIVO", deletedAt: null })) } as never;
    const service = new TeamService(teams, { record: jest.fn() } as unknown as AuditService, collaborators);

    await expect(service.addMember("team-1", "collaborator-1", false, "actor-1")).rejects.toThrow("inativo");
    expect(teams.addMember).not.toHaveBeenCalled();
  });

  it("allows a collaborator to belong to multiple teams", async () => {
    const collaborator: CollaboratorRecord = {
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
    } as unknown as TeamRepository;
    const collaborators = { findById: jest.fn(async () => collaborator) } as unknown as CollaboratorRepository;
    const service = new TeamService(teams, { record: jest.fn() } as unknown as AuditService, collaborators);

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
    } as unknown as TeamRepository;
    const collaborators = { findById: jest.fn(async () => ({
      id: "collaborator-2",
      name: "Bia",
      phone: null,
      position: "Garconete",
      status: "ATIVO",
      deletedAt: null,
    })) } as unknown as CollaboratorRepository;
    const service = new TeamService(teams, { record: jest.fn() } as unknown as AuditService, collaborators);

    await expect(service.addMember("team-1", "collaborator-2", true, "actor-1"))
      .rejects.toThrow("líder");
    expect(teams.addMember).not.toHaveBeenCalled();
  });

  it("rejects adding a member to an inactive team", async () => {
    const teams = {
      findById: jest.fn(async () => makeTeam({ status: "INATIVA" })),
      addMember: jest.fn(),
    } as unknown as TeamRepository;
    const collaborators = { findById: jest.fn(async () => ({
      id: "collaborator-1",
      name: "Ana",
      phone: null,
      position: "Cozinheira",
      status: "ATIVO",
      deletedAt: null,
    })) } as unknown as CollaboratorRepository;
    const service = new TeamService(teams, { record: jest.fn() } as unknown as AuditService, collaborators);

    await expect(service.addMember("team-1", "collaborator-1", false, "actor-1"))
      .rejects.toThrow("inativa");
    expect(teams.addMember).not.toHaveBeenCalled();
  });

  it("removes a member and records audit", async () => {
    const teams = {
      findById: jest.fn(async () => makeTeam()),
      removeMember: jest.fn(async () => undefined),
    } as unknown as TeamRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new TeamService(teams, audit);

    await service.removeMember("team-1", "collaborator-1", "actor-1");

    expect(teams.removeMember).toHaveBeenCalledWith("team-1", "collaborator-1");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "TEAM_MEMBER_REMOVED", entityId: "team-1" }));
  });

  it("deactivates a team without deleting its existing membership", async () => {
    const teams = {
      findById: jest.fn(async () => makeTeam()),
      setStatus: jest.fn(async () => makeTeam({ status: "INATIVA" })),
    } as unknown as TeamRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new TeamService(teams, audit);

    const result = await service.setActive("team-1", false, "actor-1");

    expect(teams.setStatus).toHaveBeenCalledWith("team-1", "INATIVA");
    expect(result.status).toBe("INATIVA");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "TEAM_UPDATED" }));
  });
});
