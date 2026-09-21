import type { PrismaClient } from "../../../../generated/client.js";
import type {
  CollaboratorRecord,
  CreateTeamInput,
  TeamRecord,
  TeamRepository,
  TeamListFilter,
  TeamStatus,
  UpdateTeamInput,
} from "../../domain/team.types.js";

const teamInclude = {
  members: { include: { collaborator: true } },
  events: true,
} as const;

export class PrismaTeamRepository implements TeamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateTeamInput) {
    return this.prisma.team.create({ data: input, include: teamInclude }) as Promise<TeamRecord>;
  }

  findById(id: string) {
    return this.prisma.team.findFirst({ where: { id, deletedAt: null }, include: teamInclude }) as Promise<TeamRecord | null>;
  }

  list(filter: TeamListFilter) {
    return this.prisma.team.findMany({
      where: {
        deletedAt: null,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.specialty ? { specialty: filter.specialty } : {}),
        ...(filter.search ? { name: { contains: filter.search } } : {}),
      },
      orderBy: { name: "asc" },
      include: teamInclude,
    }) as Promise<TeamRecord[]>;
  }

  update(id: string, input: UpdateTeamInput) {
    return this.prisma.team.update({ where: { id }, data: input, include: teamInclude }) as Promise<TeamRecord>;
  }

  softDelete(id: string) {
    return this.prisma.team.update({ where: { id }, data: { deletedAt: new Date() }, include: teamInclude }) as Promise<TeamRecord>;
  }

  setStatus(id: string, status: TeamStatus) {
    return this.prisma.team.update({ where: { id }, data: { status }, include: teamInclude }) as Promise<TeamRecord>;
  }

  async addMember(teamId: string, collaboratorId: string, isLeader: boolean) {
    await this.prisma.teamMember.create({ data: { teamId, collaboratorId, isLeader } });
    return this.prisma.team.findFirstOrThrow({ where: { id: teamId, deletedAt: null }, include: teamInclude }) as Promise<TeamRecord>;
  }

  async removeMember(teamId: string, collaboratorId: string) {
    await this.prisma.teamMember.delete({ where: { teamId_collaboratorId: { teamId, collaboratorId } } });
  }

  findCollaboratorById(id: string) {
    return this.prisma.collaborator.findFirst({ where: { id, deletedAt: null } }) as Promise<CollaboratorRecord | null>;
  }
}
