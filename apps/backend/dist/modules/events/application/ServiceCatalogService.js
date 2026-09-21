export class ServiceCatalogError extends Error {
    constructor(message) {
        super(message);
        this.name = "ServiceCatalogError";
    }
}
export class ServiceCatalogService {
    services;
    audit;
    constructor(services, audit) {
        this.services = services;
        this.audit = audit;
    }
    list() {
        return this.services.list();
    }
    async get(id) {
        const service = await this.services.findById(id);
        if (!service)
            throw new ServiceCatalogError("Serviço não encontrado");
        return service;
    }
    async create(input, actorId) {
        const service = await this.services.create(input);
        await this.audit.record({
            userId: actorId,
            action: "SERVICE_CREATED",
            entity: "Service",
            entityId: service.id,
            changes: input,
        });
        return service;
    }
    async update(id, input, actorId) {
        const service = await this.services.update(id, input);
        await this.audit.record({ userId: actorId, action: "SERVICE_UPDATED", entity: "Service", entityId: id, changes: input });
        return service;
    }
    async remove(id, actorId) {
        const service = await this.services.softDelete(id);
        await this.audit.record({ userId: actorId, action: "SERVICE_DELETED", entity: "Service", entityId: id });
        return service;
    }
}
