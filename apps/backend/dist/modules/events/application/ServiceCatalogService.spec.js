import { describe, expect, it, jest } from "@jest/globals";
import { ServiceCatalogService } from "./ServiceCatalogService.js";
describe("ServiceCatalogService", () => {
    it("creates a catalog service and records audit", async () => {
        const repository = {
            create: jest.fn(async (input) => ({
                id: "service-1",
                ...input,
                createdAt: new Date(),
                deletedAt: null,
            })),
        };
        const audit = { record: jest.fn(async (_input) => undefined) };
        const service = new ServiceCatalogService(repository, audit);
        const result = await service.create({ name: "Fotografia", isCustom: false }, "actor-1");
        expect(repository.create).toHaveBeenCalledWith({ name: "Fotografia", isCustom: false });
        expect(result.name).toBe("Fotografia");
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
            action: "SERVICE_CREATED",
            entity: "Service",
            entityId: "service-1",
            userId: "actor-1",
        }));
    });
});
