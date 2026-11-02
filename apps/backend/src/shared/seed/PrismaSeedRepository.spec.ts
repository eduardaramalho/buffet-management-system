import { describe, expect, it, jest } from "@jest/globals";
import type { PrismaClient } from "../../generated/client.js";
import { PrismaSeedRepository } from "./PrismaSeedRepository.js";

const createPrismaMock = () => {
  const prisma = {
    role: { upsert: jest.fn(async (_args: unknown) => ({ id: "role-1" })) },
    permission: { upsert: jest.fn(async (_args: unknown) => ({ id: "permission-1" })) },
    rolePermission: { upsert: jest.fn(async (_args: unknown) => ({})), deleteMany: jest.fn(async (_args: unknown) => ({ count: 0 })) },
    service: {
      findFirst: jest.fn(async (_args: unknown): Promise<{ id: string } | null> => null),
      create: jest.fn(async (_args: unknown) => ({}))
    },
    user: {
      findUnique: jest.fn(async (_args: unknown): Promise<{ id: string } | null> => null),
      create: jest.fn(async (_args: unknown) => ({ id: "user-1" }))
    },
    userRole: { upsert: jest.fn(async (_args: unknown) => ({})) }
  };
  return { prisma, repository: new PrismaSeedRepository(prisma as unknown as PrismaClient) };
};

describe("PrismaSeedRepository", () => {
  it("upserts roles by name and keeps the protection flag in sync", async () => {
    const { prisma, repository } = createPrismaMock();

    await expect(repository.upsertRole("admin", true)).resolves.toBe("role-1");
    expect(prisma.role.upsert).toHaveBeenCalledWith({
      where: { name: "admin" },
      update: { isProtected: true },
      create: { name: "admin", isProtected: true },
      select: { id: true }
    });
  });

  it("upserts permissions by key without changing existing ones", async () => {
    const { prisma, repository } = createPrismaMock();

    await expect(repository.upsertPermission("users:list")).resolves.toBe("permission-1");
    expect(prisma.permission.upsert).toHaveBeenCalledWith({
      where: { key: "users:list" },
      update: {},
      create: { key: "users:list" },
      select: { id: true }
    });
  });

  it("links a permission to a role idempotently", async () => {
    const { prisma, repository } = createPrismaMock();

    await repository.linkRolePermission("role-1", "permission-1");
    expect(prisma.rolePermission.upsert).toHaveBeenCalledWith({
      where: { roleId_permissionId: { roleId: "role-1", permissionId: "permission-1" } },
      update: {},
      create: { roleId: "role-1", permissionId: "permission-1" }
    });
  });

  it("revokes the role permissions that are not in the given list", async () => {
    const { prisma, repository } = createPrismaMock();

    await repository.revokeRolePermissionsExcept("role-1", ["permission-1", "permission-2"]);
    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: "role-1", permissionId: { notIn: ["permission-1", "permission-2"] } }
    });
  });

  it("looks for a generic service that was not soft deleted", async () => {
    const { prisma, repository } = createPrismaMock();

    await expect(repository.hasActiveGenericService()).resolves.toBe(false);
    prisma.service.findFirst.mockResolvedValueOnce({ id: "service-1" });
    await expect(repository.hasActiveGenericService()).resolves.toBe(true);
    expect(prisma.service.findFirst).toHaveBeenCalledWith({ where: { isCustom: true, deletedAt: null }, select: { id: true } });
  });

  it("creates the generic service flagged as custom", async () => {
    const { prisma, repository } = createPrismaMock();

    await repository.createGenericService("Outro");
    expect(prisma.service.create).toHaveBeenCalledWith({ data: { name: "Outro", isCustom: true } });
  });

  it("finds a user id by email, including soft deleted users", async () => {
    const { prisma, repository } = createPrismaMock();

    await expect(repository.findUserIdByEmail("admin@buffet.local")).resolves.toBeNull();
    prisma.user.findUnique.mockResolvedValueOnce({ id: "user-9" });
    await expect(repository.findUserIdByEmail("admin@buffet.local")).resolves.toBe("user-9");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "admin@buffet.local" }, select: { id: true } });
  });

  it("creates a user and returns its id", async () => {
    const { prisma, repository } = createPrismaMock();
    const user = { name: "Administrador", email: "admin@buffet.local", passwordHash: "hash" };

    await expect(repository.createUser(user)).resolves.toBe("user-1");
    expect(prisma.user.create).toHaveBeenCalledWith({ data: user, select: { id: true } });
  });

  it("links a role to a user idempotently", async () => {
    const { prisma, repository } = createPrismaMock();

    await repository.linkUserRole("user-1", "role-1");
    expect(prisma.userRole.upsert).toHaveBeenCalledWith({
      where: { userId_roleId: { userId: "user-1", roleId: "role-1" } },
      update: {},
      create: { userId: "user-1", roleId: "role-1" }
    });
  });
});
