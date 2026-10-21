export const clientTypes = ["PF", "PJ"] as const;
export type ClientType = (typeof clientTypes)[number];

export type ClientRecord = {
  id: string;
  type: ClientType;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type CreateClientInput = {
  type: ClientType;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type UpdateClientInput = Partial<CreateClientInput>;

export type ClientListFilter = { search?: string };

export interface ClientRepository {
  findById(id: string): Promise<ClientRecord | null>;
  // Includes soft-deleted clients: the unique index on document is global.
  findByDocument(document: string): Promise<ClientRecord | null>;
  list(filter: ClientListFilter): Promise<ClientRecord[]>;
  create(input: CreateClientInput): Promise<ClientRecord>;
  update(id: string, input: UpdateClientInput): Promise<ClientRecord>;
  softDelete(id: string): Promise<ClientRecord>;
  // Non-deleted events that are not CONCLUIDO/CANCELADO.
  countOpenEvents(clientId: string): Promise<number>;
}

export interface ClientAuditService {
  record(input: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    changes?: Record<string, unknown>;
    reason?: string;
  }): Promise<void>;
}
