import { describe, expect, it, jest } from "@jest/globals";

import { EventTeamService } from "./EventTeamService.js";
import type { AuditService, EventSchedulingRecord, EventTeamRepository, TeamAssignmentRecord } from "../domain/team.types.js";

const makeEvent = (overrides: Partial<EventSchedulingRecord> = {}): EventSchedulingRecord => ({
  id: "event-1",
  name: "Casamento de Alice",
  eventDate: new Date("2026-10-10T15:00:00.000Z"),
  endDate: new Date("2026-10-10T22:00:00.000Z"),
  status: "PLANEJAMENTO",
  deletedAt: null,
  ...overrides,
});

const makeTeam = (overrides: Partial<TeamAssignmentRecord> = {}): TeamAssignmentRecord => ({
  id: "team-1",
  status: "ATIVA",
  deletedAt: null,
  ...overrides,
});

describe("EventTeamService", () => {
  it("rejects assignment when the event is missing or deleted", async () => {
    const eventTeams = { findEventById: jest.fn(async () => null) } as unknown as EventTeamRepository;
    const service = new EventTeamService(eventTeams, { record: jest.fn() } as unknown as AuditService);

    await expect(service.assignTeamToEvent("missing", "team-1", "actor-1")).rejects.toThrow("Evento não encontrado");
  });

  it("rejects assignment to an unknown team", async () => {
    const eventTeams = {
      findEventById: jest.fn(async () => makeEvent()),
      findTeamById: jest.fn(async () => null),
    } as unknown as EventTeamRepository;
    const service = new EventTeamService(eventTeams, { record: jest.fn() } as unknown as AuditService);

    await expect(service.assignTeamToEvent("event-1", "missing", "actor-1")).rejects.toThrow("Equipe não encontrada");
  });

  it("unassigns a team and records audit", async () => {
    const eventTeams = { unassign: jest.fn(async () => undefined) } as unknown as EventTeamRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new EventTeamService(eventTeams, audit);

    await service.unassignTeamFromEvent("event-1", "team-1", "actor-1");

    expect(eventTeams.unassign).toHaveBeenCalledWith("event-1", "team-1");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "TEAM_UNASSIGNED_FROM_EVENT", entityId: "event-1" }));
  });

  it("lists team assignments by event and event assignments by team", async () => {
    const eventTeams = {
      listTeamsByEvent: jest.fn(async () => []),
      listAssignmentsByTeam: jest.fn(async () => []),
    } as unknown as EventTeamRepository;
    const service = new EventTeamService(eventTeams, { record: jest.fn() } as unknown as AuditService);

    await expect(service.listTeamsByEvent("event-1")).resolves.toEqual([]);
    await expect(service.listEventsByTeam("team-1")).resolves.toEqual([]);
  });
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
    } as unknown as EventTeamRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
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
    } as unknown as EventTeamRepository;
    const service = new EventTeamService(eventTeams, { record: jest.fn() } as unknown as AuditService);

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
    } as unknown as EventTeamRepository;
    const service = new EventTeamService(eventTeams, { record: jest.fn() } as unknown as AuditService);

    await expect(service.assignTeamToEvent("event-1", "team-1", "actor-1"))
      .rejects.toThrow("concluído");
    expect(eventTeams.assign).not.toHaveBeenCalled();
  });

  describe("checkAvailability (shared by assignment, RF11, and replication, RF25)", () => {
    const schedule = { eventDate: new Date("2026-10-10T15:00:00.000Z"), endDate: new Date("2026-10-10T22:00:00.000Z") };
    const repositoryWith = (team: TeamAssignmentRecord | null, events: EventSchedulingRecord[] = []) => ({
      findTeamById: jest.fn(async () => team),
      listEventsByTeam: jest.fn(async () => events),
    }) as unknown as EventTeamRepository;

    it("reports a missing team and an inactive team", async () => {
      const missing = new EventTeamService(repositoryWith(null), { record: jest.fn() } as unknown as AuditService);
      const inactive = new EventTeamService(repositoryWith(makeTeam({ status: "INATIVA" })), { record: jest.fn() } as unknown as AuditService);

      await expect(missing.checkAvailability("team-1", schedule)).resolves.toEqual({ available: false, reason: "NOT_FOUND" });
      await expect(inactive.checkAvailability("team-1", schedule)).resolves.toEqual({ available: false, reason: "INACTIVE" });
    });

    it("reports a schedule conflict with the id and name of the conflicting event", async () => {
      const busy = makeEvent({ id: "event-9", name: "Formatura X", eventDate: new Date("2026-10-10T20:00:00.000Z"), endDate: new Date("2026-10-11T01:00:00.000Z") });
      const service = new EventTeamService(repositoryWith(makeTeam(), [busy]), { record: jest.fn() } as unknown as AuditService);

      await expect(service.checkAvailability("team-1", schedule)).resolves.toEqual({
        available: false,
        reason: "SCHEDULE_CONFLICT",
        conflictingEvent: { id: "event-9", name: "Formatura X" },
      });
    });

    it("treats an event without end date as occupying the whole day (RN09)", async () => {
      const busy = makeEvent({ id: "event-9", eventDate: new Date("2026-10-10T08:00:00.000Z"), endDate: null });
      const service = new EventTeamService(repositoryWith(makeTeam(), [busy]), { record: jest.fn() } as unknown as AuditService);

      await expect(service.checkAvailability("team-1", { eventDate: new Date("2026-10-10T23:00:00.000Z"), endDate: null }))
        .resolves.toEqual(expect.objectContaining({ available: false, reason: "SCHEDULE_CONFLICT" }));
    });

    it("ignores the event being scheduled itself and non-overlapping events", async () => {
      const sameEvent = makeEvent({ id: "event-1" });
      const otherDay = makeEvent({ id: "event-2", eventDate: new Date("2026-10-11T15:00:00.000Z"), endDate: new Date("2026-10-11T22:00:00.000Z") });
      const service = new EventTeamService(repositoryWith(makeTeam(), [sameEvent, otherDay]), { record: jest.fn() } as unknown as AuditService);

      await expect(service.checkAvailability("team-1", schedule, "event-1")).resolves.toEqual({ available: true });
    });

    it("keeps the assignment error messages built on top of it", async () => {
      const busy = makeEvent({ id: "event-9", eventDate: new Date("2026-10-10T16:00:00.000Z"), endDate: new Date("2026-10-10T18:00:00.000Z") });
      const eventTeams = { ...repositoryWith(makeTeam(), [busy]), findEventById: jest.fn(async () => makeEvent()), assign: jest.fn() } as unknown as EventTeamRepository;
      const service = new EventTeamService(eventTeams, { record: jest.fn() } as unknown as AuditService);

      await expect(service.assignTeamToEvent("event-1", "team-1", "actor-1")).rejects.toThrow("conflito de agenda: a equipe já está atribuída ao evento event-9");
    });
  });
});
