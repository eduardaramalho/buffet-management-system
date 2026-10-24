import { describe, expect, it, jest } from "@jest/globals";

import { PrismaServiceRepository } from "./PrismaServiceRepository.js";

describe("PrismaServiceRepository", () => {
  it("reads only active services", async () => {
    const findFirst = jest.fn(async (_args: unknown) => null);
    const findMany = jest.fn(async (_args: unknown) => []);
    const repository = new PrismaServiceRepository({ service: { findFirst, findMany } } as never);

    await repository.findById("service-1");
    await repository.list();

    expect(findFirst).toHaveBeenCalledWith({ where: { id: "service-1", deletedAt: null } });
    expect(findMany).toHaveBeenCalledWith({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  });

  it("finds an active service by name, optionally ignoring one id (RF06 uniqueness)", async () => {
    const findFirst = jest.fn(async (_args: unknown) => null);
    const repository = new PrismaServiceRepository({ service: { findFirst } } as never);

    await repository.findActiveByName("Bar");
    await repository.findActiveByName("Bar", "service-1");

    expect(findFirst).toHaveBeenNthCalledWith(1, { where: { name: "Bar", deletedAt: null } });
    expect(findFirst).toHaveBeenNthCalledWith(2, { where: { name: "Bar", deletedAt: null, NOT: { id: "service-1" } } });
  });

  it("finds the active generic service", async () => {
    const findFirst = jest.fn(async (_args: unknown) => null);
    const repository = new PrismaServiceRepository({ service: { findFirst } } as never);

    await repository.findActiveCustom();

    expect(findFirst).toHaveBeenCalledWith({ where: { isCustom: true, deletedAt: null } });
  });

  it("creates, updates and soft-deletes without physical deletion", async () => {
    const create = jest.fn(async (_args: unknown) => ({}));
    const update = jest.fn(async (_args: unknown) => ({}));
    const repository = new PrismaServiceRepository({ service: { create, update } } as never);

    await repository.create({ name: "Bar", isCustom: false });
    await repository.update("service-1", { name: "Bar 2" });
    await repository.softDelete("service-1");

    expect(create).toHaveBeenCalledWith({ data: { name: "Bar", isCustom: false } });
    expect(update).toHaveBeenNthCalledWith(1, { where: { id: "service-1" }, data: { name: "Bar 2" } });
    expect(update).toHaveBeenNthCalledWith(2, { where: { id: "service-1" }, data: { deletedAt: expect.any(Date) } });
  });
});
