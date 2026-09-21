const eventInclude = {
    services: { include: { service: true } },
};
export class PrismaEventRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(input) {
        return this.prisma.event.create({ data: input, include: eventInclude });
    }
    findById(id) {
        return this.prisma.event.findFirst({ where: { id, deletedAt: null }, include: eventInclude });
    }
    list(filter) {
        return this.prisma.event.findMany({
            where: {
                deletedAt: null,
                ...(filter.status ? { status: filter.status } : {}),
                ...(filter.search ? { OR: [{ name: { contains: filter.search } }, { location: { contains: filter.search } }] } : {}),
                ...(filter.from || filter.to ? { eventDate: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } } : {}),
            },
            orderBy: { eventDate: "asc" },
            include: eventInclude,
        });
    }
    update(id, input) {
        const { reason: _reason, ...data } = input;
        return this.prisma.event.update({ where: { id }, data, include: eventInclude });
    }
    softDelete(id) {
        return this.prisma.event.update({ where: { id }, data: { deletedAt: new Date() }, include: eventInclude });
    }
    restore(id) {
        return this.prisma.event.update({ where: { id }, data: { deletedAt: null }, include: eventInclude });
    }
    async attachService(input) {
        await this.prisma.eventService.upsert({
            where: { eventId_serviceId: { eventId: input.eventId, serviceId: input.serviceId } },
            update: { customLabel: input.customLabel },
            create: { eventId: input.eventId, serviceId: input.serviceId, customLabel: input.customLabel },
        });
        return this.prisma.event.findFirstOrThrow({ where: { id: input.eventId, deletedAt: null }, include: eventInclude });
    }
    async detachService(eventId, serviceId) {
        await this.prisma.eventService.delete({ where: { eventId_serviceId: { eventId, serviceId } } });
    }
}
