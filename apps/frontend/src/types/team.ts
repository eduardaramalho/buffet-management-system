export const TEAM_SPECIALTIES = ['COZINHA', 'SALAO', 'BAR', 'DECORACAO', 'LIMPEZA', 'CERIMONIAL', 'OUTRO'] as const
export type TeamSpecialty = typeof TEAM_SPECIALTIES[number]
export type TeamStatus = 'ATIVA' | 'INATIVA'
export type CollaboratorStatus = 'ATIVO' | 'INATIVO'

export type Collaborator = {
  id: string
  name: string
  phone: string | null
  position: string
  status: CollaboratorStatus
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type TeamMember = {
  collaboratorId: string
  isLeader: boolean
  collaborator: Collaborator
}

export type EventTeamAssignment = {
  eventId: string
  teamId: string
  assignedAt: string
  assignedById: string
}

export type Team = {
  id: string
  name: string
  specialty: TeamSpecialty
  status: TeamStatus
  observations: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  members: TeamMember[]
  events: EventTeamAssignment[]
}

export type CreateTeamInput = Pick<Team, 'name' | 'specialty' | 'observations'>
export type UpdateTeamInput = Partial<CreateTeamInput>
export type TeamFilters = { search?: string; specialty?: TeamSpecialty; status?: TeamStatus }
export type CreateCollaboratorInput = Pick<Collaborator, 'name' | 'phone' | 'position'>
export type UpdateCollaboratorInput = Partial<CreateCollaboratorInput>
export type CollaboratorFilters = { search?: string }
