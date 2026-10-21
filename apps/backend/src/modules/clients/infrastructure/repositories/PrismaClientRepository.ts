import type { PrismaClient } from "../../../../generated/client.js";
import { ClientConflictError } from "../../domain/client.errors.js";
import { normalizeDocument } from "../../domain/document.js";
import type {
  ClientListFilter,
  ClientRecord,
  ClientRepository,
  CreateClientInput,
  UpdateClientInput,
} from "../../domain/client.types.js";

const UNIQUE_VIOLATION = "P2002";
const TERMINAL_EVENT_STATUSES = ["CONCLUIDO", "CANCELADO"] as const;

// The service checks for duplicates before writing; this covers the race where two requests pass that check.
const translateUniqueViolation = (error: unknown): never => {
  if ((error as { code?: string })?.code === UNIQUE_VIOLATION) throw new ClientConflictError("Já existe um cliente com este documento");
  throw error;
};

export class PrismaClientRepository implements ClientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string) {
    return this.prisma.client.findFirst({ where: { id, deletedAt: null } }) as Promise<ClientRecord | null>;
  }

  findByDocument(document: string) {
    return this.prisma.client.findUnique({ where: { document } }) as Promise<ClientRecord | null>;
  }

  list(filter: ClientListFilter) {
    return this.prisma.client.findMany({
      where: { deletedAt: null, ...(filter.search ? { OR: this.searchConditions(filter.search) } : {}) },
      orderBy: { name: "asc" },
    }) as Promise<ClientRecord[]>;
  }

  create(input: CreateClientInput) {
    return this.prisma.client.create({ data: input }).catch(translateUniqueViolation) as Promise<ClientRecord>;
  }

  update(id: string, input: UpdateClientInput) {
    return this.prisma.client.update({ where: { id }, data: input }).catch(translateUniqueViolation) as Promise<ClientRecord>;
  }

  softDelete(id: string) {
    return this.prisma.client.update({ where: { id }, data: { deletedAt: new Date() } }) as Promise<ClientRecord>;
  }

  countOpenEvents(clientId: string) {
    return this.prisma.event.count({
      where: { clientId, deletedAt: null, status: { notIn: [...TERMINAL_EVENT_STATUSES] } },
    });
  }

  // Documents are stored without punctuation, so the term is normalized before matching "529.982" against "52998224725".
  private searchConditions(search: string) {
    const document = normalizeDocument(search);
    return [
      { name: { contains: search } },
      { email: { contains: search } },
      ...(document ? [{ document: { contains: document } }] : []),
    ];
  }
}
