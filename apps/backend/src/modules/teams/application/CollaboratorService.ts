import type {
  AuditService,
  CollaboratorRepository,
  CollaboratorStatus,
  CreateCollaboratorInput,
  UpdateCollaboratorInput,
} from "../domain/team.types.js";

export class CollaboratorManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollaboratorManagementError";
  }
}

export class CollaboratorService {
  constructor(
    private readonly collaborators: CollaboratorRepository,
    private readonly audit: AuditService,
  ) {}

  list(filter: Parameters<CollaboratorRepository["list"]>[0] = {}) {
    return this.collaborators.list(filter);
  }

  async get(id: string) {
    const collaborator = await this.collaborators.findById(id);
    if (!collaborator) throw new CollaboratorManagementError("Colaborador não encontrado");
    return collaborator;
  }

  async create(input: CreateCollaboratorInput, actorId: string) {
    const name = input.name.trim();
    const position = input.position.trim();
    if (!name) throw new CollaboratorManagementError("O nome do colaborador é obrigatório");
    if (!position) throw new CollaboratorManagementError("A função do colaborador é obrigatória");

    const collaborator = await this.collaborators.create({ ...input, name, position });
    await this.audit.record({
      userId: actorId,
      action: "COLLABORATOR_CREATED",
      entity: "Collaborator",
      entityId: collaborator.id,
      changes: { name: collaborator.name, position: collaborator.position },
    });
    return collaborator;
  }

  async update(id: string, input: UpdateCollaboratorInput, actorId: string) {
    await this.get(id);
    const name = input.name?.trim();
    const position = input.position?.trim();
    if (input.name !== undefined && !name) throw new CollaboratorManagementError("O nome do colaborador é obrigatório");
    if (input.position !== undefined && !position) throw new CollaboratorManagementError("A função do colaborador é obrigatória");

    const collaborator = await this.collaborators.update(id, { ...input, name, position });
    await this.audit.record({
      userId: actorId,
      action: "COLLABORATOR_UPDATED",
      entity: "Collaborator",
      entityId: id,
      changes: { after: collaborator },
    });
    return collaborator;
  }

  async setActive(id: string, active: boolean, actorId: string) {
    await this.get(id);
    const status: CollaboratorStatus = active ? "ATIVO" : "INATIVO";
    const collaborator = await this.collaborators.setStatus(id, status);
    await this.audit.record({
      userId: actorId,
      action: "COLLABORATOR_STATUS_CHANGED",
      entity: "Collaborator",
      entityId: id,
      changes: { status },
    });
    return collaborator;
  }
}
