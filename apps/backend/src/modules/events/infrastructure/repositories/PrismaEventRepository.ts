import type { PrismaClient } from "../../../../generated/client.js";
import type { TransactionClient } from "../../../../shared/domain/transaction.types.js";
import type { CreateReplicaInput, ReplicationEventStore } from "../../domain/eventReplication.types.js";
import type {
  AttachServiceInput,
  CreateEventInput,
  EventListFilter,
  EventRepository,
  EventRecord,
  UpdateEventInput,
} from "../../domain/event.types.js";

const eventInclude = {
  services: { include: { service: true } },
  client: { select: { id: true, name: true, email: true, phone: true, deletedAt: true } },
} as const;

// Detail read only: the lineage (RF25) would add two joins per row to the list query.
const eventDetailInclude = {
  ...eventInclude,
  sourceEvent: { select: { id: true, name: true, eventDate: true, deletedAt: true } },
  replicas: { where: { deletedAt: null }, select: { id: true, name: true, eventDate: true, status: true }, orderBy: { createdAt: "asc" } },
} as const;

export class PrismaEventRepository implements EventRepository, ReplicationEventStore {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateEventInput & { status: "PLANEJAMENTO" }) {
    return this.prisma.event.create({ data: input, include: eventInclude }) as Promise<EventRecord>;
  }

  findById(id: string) {
    return this.prisma.event.findFirst({ where: { id, deletedAt: null }, include: eventInclude }) as Promise<EventRecord | null>;
  }

  findDetailById(id: string) {
    return this.prisma.event.findFirst({ where: { id, deletedAt: null }, include: eventDetailInclude }) as Promise<EventRecord | null>;
  }

  // Event and contracted services in a single nested insert, inside the replication transaction.
  createReplica(input: CreateReplicaInput, tx: TransactionClient) {
    const client = tx as PrismaClient;
    const { services, ...event } = input;
    return client.event.create({
      data: { ...event, status: "PLANEJAMENTO", services: { create: services } },
      include: eventInclude,
    }) as Promise<EventRecord>;
  }

  list(filter: EventListFilter) {
    return this.prisma.event.findMany({
      where: {
        deletedAt: null,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.search ? { OR: [{ name: { contains: filter.search } }, { location: { contains: filter.search } }] } : {}),
        ...(filter.from || filter.to ? { eventDate: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } } : {}),
      },
      orderBy: { eventDate: "asc" },
      include: eventInclude,
    }) as Promise<EventRecord[]>;
  }

  update(id: string, input: UpdateEventInput) {
    const { reason: _reason, ...data } = input;
    return this.prisma.event.update({ where: { id }, data, include: eventInclude }) as Promise<EventRecord>;
  }

  softDelete(id: string) {
    return this.prisma.event.update({ where: { id }, data: { deletedAt: new Date() }, include: eventInclude }) as Promise<EventRecord>;
  }

  restore(id: string) {
    return this.prisma.event.update({ where: { id }, data: { deletedAt: null }, include: eventInclude }) as Promise<EventRecord>;
  }

  async attachService(input: AttachServiceInput) {
    await this.prisma.eventService.upsert({
      where: { eventId_serviceId: { eventId: input.eventId, serviceId: input.serviceId } },
      update: { customLabel: input.customLabel },
      create: { eventId: input.eventId, serviceId: input.serviceId, customLabel: input.customLabel },
    });
    return this.prisma.event.findFirstOrThrow({ where: { id: input.eventId, deletedAt: null }, include: eventInclude }) as Promise<EventRecord>;
  }

  async detachService(eventId: string, serviceId: string) {
    await this.prisma.eventService.delete({ where: { eventId_serviceId: { eventId, serviceId } } });
  }
}