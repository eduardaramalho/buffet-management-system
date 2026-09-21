import type { PrismaClient } from "../../../../generated/client.js";
import type {
  EventSchedulingRecord,
  EventTeamAssignment,
  EventTeamRepository,
  TeamAssignmentRecord,
} from "../../domain/team.types.js";

export class PrismaEventTeamRepository implements EventTeamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findEventById(id: string) {
    return this.prisma.event.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, eventDate: true, endDate: true, status: true, deletedAt: true },
    }) as Promise<EventSchedulingRecord | null>;
  }

  findTeamById(id: string) {
    return this.prisma.team.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, deletedAt: true },
    }) as Promise<TeamAssignmentRecord | null>;
  }

  listEventsByTeam(teamId: string) {
    return this.prisma.event.findMany({
      where: { deletedAt: null, teams: { some: { teamId } } },
      select: { id: true, eventDate: true, endDate: true, status: true, deletedAt: true },
      orderBy: { eventDate: "asc" },
    }) as Promise<EventSchedulingRecord[]>;
  }

  assign(eventId: string, teamId: string, assignedById: string) {
    return this.prisma.eventTeam.create({
      data: { eventId, teamId, assignedById },
    }) as Promise<EventTeamAssignment>;
  }

  async unassign(eventId: string, teamId: string) {
    await this.prisma.eventTeam.delete({ where: { eventId_teamId: { eventId, teamId } } });
  }

  listTeamsByEvent(eventId: string) {
    return this.prisma.eventTeam.findMany({
      where: { eventId },
      orderBy: { assignedAt: "asc" },
    }) as Promise<EventTeamAssignment[]>;
  }

  listAssignmentsByTeam(teamId: string) {
    return this.prisma.eventTeam.findMany({
      where: { teamId, event: { deletedAt: null } },
      orderBy: { assignedAt: "asc" },
    }) as Promise<EventTeamAssignment[]>;
  }
}
