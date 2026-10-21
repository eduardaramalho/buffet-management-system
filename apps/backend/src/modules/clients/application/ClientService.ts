import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { ClientConflictError, ClientManagementError } from "../domain/client.errors.js";
import { isValidDocument, normalizeDocument } from "../domain/document.js";
import type {
  ClientAuditService,
  ClientListFilter,
  ClientRecord,
  ClientRepository,
  ClientType,
  CreateClientInput,
  UpdateClientInput,
} from "../domain/client.types.js";

const ENTITY = "Client";

const optionalText = (value: string | null | undefined) => value?.trim() || null;
const optionalEmail = (value: string | null | undefined) => optionalText(value)?.toLowerCase() ?? null;

export class ClientService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly audit: ClientAuditService,
  ) {}

  list(filter: ClientListFilter = {}) {
    return this.clients.list(filter);
  }

  async get(id: string) {
    const client = await this.clients.findById(id);
    if (!client) throw new NotFoundError("Cliente não encontrado");
    return client;
  }

  async create(input: CreateClientInput, actorId: string) {
    const document = this.prepareDocument(input.type, input.document);
    if (document) await this.assertDocumentAvailable(document);

    const client = await this.clients.create({
      type: input.type,
      name: this.requireName(input.name),
      document,
      email: optionalEmail(input.email),
      phone: optionalText(input.phone),
      notes: optionalText(input.notes),
    });
    // Audit records only non-sensitive identifiers (LGPD data minimization): no document, email or phone values.
    await this.audit.record({
      userId: actorId,
      action: "CLIENT_CREATED",
      entity: ENTITY,
      entityId: client.id,
      changes: { name: client.name, type: client.type },
    });
    return client;
  }

  async update(id: string, input: UpdateClientInput, actorId: string) {
    const current = await this.get(id);
    const data: UpdateClientInput = {};

    if (input.type !== undefined) data.type = input.type;
    if (input.name !== undefined) data.name = this.requireName(input.name);
    // A type change must revalidate the stored document (a CPF is not a valid CNPJ and vice versa).
    if (input.document !== undefined || input.type !== undefined) {
      const document = this.prepareDocument(data.type ?? current.type, input.document !== undefined ? input.document : current.document);
      if (document && document !== current.document) await this.assertDocumentAvailable(document);
      // Stored documents are already normalized, so a type-only change never alters the document itself.
      if (input.document !== undefined) data.document = document;
    }
    if (input.email !== undefined) data.email = optionalEmail(input.email);
    if (input.phone !== undefined) data.phone = optionalText(input.phone);
    if (input.notes !== undefined) data.notes = optionalText(input.notes);

    const client = await this.clients.update(id, data);
    await this.audit.record({
      userId: actorId,
      action: "CLIENT_UPDATED",
      entity: ENTITY,
      entityId: id,
      changes: { name: client.name, fields: Object.keys(data) },
    });
    return client;
  }

  async remove(id: string, actorId: string): Promise<ClientRecord> {
    const client = await this.get(id);
    const openEvents = await this.clients.countOpenEvents(id);
    if (openEvents > 0) {
      const label = openEvents === 1 ? "1 evento" : `${openEvents} eventos`;
      throw new ClientConflictError(`O cliente possui ${label} em aberto e não pode ser excluído`);
    }

    // Soft delete keeps the link with finished events (history); personal data is kept (see ADR 0005).
    const deleted = await this.clients.softDelete(id);
    await this.audit.record({
      userId: actorId,
      action: "CLIENT_DELETED",
      entity: ENTITY,
      entityId: id,
      changes: { name: client.name },
    });
    return deleted;
  }

  private requireName(value: string) {
    const name = value.trim();
    if (!name) throw new ClientManagementError("O nome do cliente é obrigatório");
    return name;
  }

  private prepareDocument(type: ClientType, value: string | null | undefined) {
    if (!value?.trim()) return null;
    const document = normalizeDocument(value);
    if (!isValidDocument(type, document)) throw new ClientManagementError(type === "PF" ? "CPF inválido" : "CNPJ inválido");
    return document;
  }

  private async assertDocumentAvailable(document: string) {
    const owner = await this.clients.findByDocument(document);
    if (!owner) return;
    // Reactivating a deleted client is out of scope today, so the message tells the user why the document is taken.
    throw new ClientConflictError(owner.deletedAt ? "Este documento pertence a um cliente excluído" : "Já existe um cliente com este documento");
  }
}
