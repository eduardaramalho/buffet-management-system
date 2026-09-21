import type { EventAuditService, ServiceRecord, ServiceRepository } from "../domain/event.types.js";

export class ServiceCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceCatalogError";
  }
}

export class ServiceCatalogService {
  constructor(
    private readonly services: ServiceRepository,
    private readonly audit: EventAuditService
  ) {}

  list() {
    return this.services.list();
  }

  async get(id: string) {
    const service = await this.services.findById(id);
    if (!service) throw new ServiceCatalogError("Serviço não encontrado");
    return service;
  }

  async create(input: { name: string; isCustom: boolean }, actorId: string): Promise<ServiceRecord> {
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

  async update(id: string, input: { name?: string; isCustom?: boolean }, actorId: string) {
    const service = await this.services.update(id, input);
    await this.audit.record({ userId: actorId, action: "SERVICE_UPDATED", entity: "Service", entityId: id, changes: input });
    return service;
  }

  async remove(id: string, actorId: string) {
    const service = await this.services.softDelete(id);
    await this.audit.record({ userId: actorId, action: "SERVICE_DELETED", entity: "Service", entityId: id });
    return service;
  }
}