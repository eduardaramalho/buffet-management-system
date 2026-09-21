export class CollaboratorManagementError extends Error {
    constructor(message) {
        super(message);
        this.name = "CollaboratorManagementError";
    }
}
export class CollaboratorService {
    collaborators;
    audit;
    constructor(collaborators, audit) {
        this.collaborators = collaborators;
        this.audit = audit;
    }
    list(filter = {}) {
        return this.collaborators.list(filter);
    }
    async get(id) {
        const collaborator = await this.collaborators.findById(id);
        if (!collaborator)
            throw new CollaboratorManagementError("Colaborador não encontrado");
        return collaborator;
    }
    async create(input, actorId) {
        const name = input.name.trim();
        const position = input.position.trim();
        if (!name)
            throw new CollaboratorManagementError("O nome do colaborador é obrigatório");
        if (!position)
            throw new CollaboratorManagementError("A função do colaborador é obrigatória");
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
    async update(id, input, actorId) {
        await this.get(id);
        const name = input.name?.trim();
        const position = input.position?.trim();
        if (input.name !== undefined && !name)
            throw new CollaboratorManagementError("O nome do colaborador é obrigatório");
        if (input.position !== undefined && !position)
            throw new CollaboratorManagementError("A função do colaborador é obrigatória");
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
    async setActive(id, active, actorId) {
        await this.get(id);
        const status = active ? "ATIVO" : "INATIVO";
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
