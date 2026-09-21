import type { PrismaClient } from "../../../../generated/client.js";
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
} as const;

export class PrismaEventRepository implements EventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateEventInput & { status: "PLANEJAMENTO" }) {
    return this.prisma.event.create({ data: input, include: eventInclude }) as Promise<EventRecord>;
  }

  findById(id: string) {
    return this.prisma.event.findFirst({ where: { id, deletedAt: null }, include: eventInclude }) as Promise<EventRecord | null>;
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