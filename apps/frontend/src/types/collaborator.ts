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

export type CreateCollaboratorInput = Pick<Collaborator, 'name' | 'phone' | 'position'>
export type UpdateCollaboratorInput = Partial<CreateCollaboratorInput>
export type CollaboratorFilters = { search?: string }
