import { describe, expect, it, jest } from "@jest/globals";
import { PrismaEventRepository } from "./PrismaEventRepository.js";
describe("PrismaEventRepository", () => {
    it("filters out soft-deleted events and applies status/date filters", async () => {
        const findMany = jest.fn(async () => []);
        const prisma = { event: { findMany } };
        const repository = new PrismaEventRepository(prisma);
        const from = new Date("2026-10-01T00:00:00.000Z");
        const to = new Date("2026-10-31T23:59:59.000Z");
        await repository.list({ status: "CONFIRMADO", from, to });
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ deletedAt: null, status: "CONFIRMADO", eventDate: { gte: from, lte: to } }),
            orderBy: { eventDate: "asc" },
        }));
    });
    it("soft deletes with an update and never performs physical deletion", async () => {
        const update = jest.fn(async () => ({}));
        const prisma = { event: { update } };
        const repository = new PrismaEventRepository(prisma);
        await repository.softDelete("event-1");
        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "event-1" },
            data: { deletedAt: expect.any(Date) },
        }));
    });
});
