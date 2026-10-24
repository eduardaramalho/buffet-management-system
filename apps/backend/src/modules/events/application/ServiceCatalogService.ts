import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import type { EventAuditService, ServiceRecord, ServiceRepository } from "../domain/event.types.js";

/** Business rule violation in the catalog (HTTP 400). */
export class ServiceCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceCatalogError";
  }
}

/** Conflict with the current catalog: duplicated name or a second generic service (HTTP 409). */
export class ServiceCatalogConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceCatalogConflictError";
  }
}

const NOT_FOUND = "Serviço não encontrado";

/**
 * RF06 (ADR 0009): catalog of contractable services.
 * - Names are unique among active services (case and accents ignored by the MySQL collation).
 * - "Outro" (isCustom) is a single, protected entry (ADR 0001): it cannot be removed, and no service
 *   changes type, since that would invalidate the custom labels already stored in contracted events.
 * - Removal is a soft delete: events keep the service in their history; new events no longer offer it.
 */
export class ServiceCatalogService {
  constructor(
    private readonly services: ServiceRepository,
    private readonly audit: EventAuditService
  ) {}

  list() {
    return this.services.list();
  }

  async get(id: string): Promise<ServiceRecord> {
    const service = await this.services.findById(id);
    if (!service) throw new NotFoundError(NOT_FOUND);
    return service;
  }

  async create(input: { name: string; isCustom: boolean }, actorId: string): Promise<ServiceRecord> {
    const name = this.normalizeName(input.name);
    await this.assertNameAvailable(name);
    if (input.isCustom && (await this.services.findActiveCustom())) {
      throw new ServiceCatalogConflictError("O catálogo já tem o serviço genérico Outro");
    }

    const data = { name, isCustom: input.isCustom };
    const service = await this.services.create(data);
    await this.audit.record({ userId: actorId, action: "SERVICE_CREATED", entity: "Service", entityId: service.id, changes: data });
    return service;
  }

  async update(id: string, input: { name?: string; isCustom?: boolean }, actorId: string): Promise<ServiceRecord> {
    const current = await this.get(id);
    if (input.isCustom !== undefined && input.isCustom !== current.isCustom) {
      throw new ServiceCatalogError("O tipo do serviço não pode ser alterado");
    }

    const data: { name?: string } = {};
    if (input.name !== undefined) {
      data.name = this.normalizeName(input.name);
      await this.assertNameAvailable(data.name, id);
    }

    const updated = await this.services.update(id, data);
    await this.audit.record({
      userId: actorId,
      action: "SERVICE_UPDATED",
      entity: "Service",
      entityId: id,
      changes: { name: updated.name, before: { name: current.name }, after: { name: updated.name } },
    });
    return updated;
  }

  async remove(id: string, actorId: string): Promise<ServiceRecord> {
    const current = await this.get(id);
    if (current.isCustom) throw new ServiceCatalogError("O serviço genérico Outro não pode ser excluído");

    const removed = await this.services.softDelete(id);
    await this.audit.record({ userId: actorId, action: "SERVICE_DELETED", entity: "Service", entityId: id, changes: { name: current.name } });
    return removed;
  }

  private normalizeName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new ServiceCatalogError("Informe o nome do serviço");
    return trimmed;
  }

  private async assertNameAvailable(name: string, excludeId?: string) {
    const sameName = excludeId ? await this.services.findActiveByName(name, excludeId) : await this.services.findActiveByName(name);
    if (sameName) throw new ServiceCatalogConflictError("Já existe um serviço com este nome");
  }
}