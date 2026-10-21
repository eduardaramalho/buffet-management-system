import { describe, expect, it, jest } from "@jest/globals";

import { PrismaClientRepository } from "./PrismaClientRepository.js";
import { ClientConflictError } from "../../domain/client.errors.js";

const input = { type: "PF" as const, name: "Ana", document: "52998224725", email: null, phone: null, notes: null };
const uniqueViolation = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

describe("PrismaClientRepository", () => {
  it("finds an active client by id without exposing deleted records", async () => {
    const findFirst = jest.fn(async (_args: unknown) => null);
    const repository = new PrismaClientRepository({ client: { findFirst } } as never);

    await repository.findById("client-1");

    expect(findFirst).toHaveBeenCalledWith({ where: { id: "client-1", deletedAt: null } });
  });

  it("finds by document including deleted records, because the unique index is global", async () => {
    const findUnique = jest.fn(async (_args: unknown) => null);
    const repository = new PrismaClientRepository({ client: { findUnique } } as never);

    await repository.findByDocument("52998224725");

    expect(findUnique).toHaveBeenCalledWith({ where: { document: "52998224725" } });
  });

  it("lists active clients ordered by name", async () => {
    const findMany = jest.fn(async (_args: unknown) => []);
    const repository = new PrismaClientRepository({ client: { findMany } } as never);

    await repository.list({});

    expect(findMany).toHaveBeenCalledWith({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  });

  it("searches by name, email and normalized document", async () => {
    const findMany = jest.fn(async (_args: unknown) => []);
    const repository = new PrismaClientRepository({ client: { findMany } } as never);

    await repository.list({ search: "529.982" });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        OR: [{ name: { contains: "529.982" } }, { email: { contains: "529.982" } }, { document: { contains: "529982" } }],
      },
      orderBy: { name: "asc" },
    });
  });

  it("does not search the document when the term has no document characters", async () => {
    const findMany = jest.fn(async (_args: unknown) => []);
    const repository = new PrismaClientRepository({ client: { findMany } } as never);

    await repository.list({ search: " - " });

    expect(findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, OR: [{ name: { contains: " - " } }, { email: { contains: " - " } }] },
      orderBy: { name: "asc" },
    });
  });

  it("creates and updates a client", async () => {
    const create = jest.fn(async (_args: unknown) => ({}));
    const update = jest.fn(async (_args: unknown) => ({}));
    const repository = new PrismaClientRepository({ client: { create, update } } as never);

    await repository.create(input);
    await repository.update("client-1", { name: "Ana Lima" });

    expect(create).toHaveBeenCalledWith({ data: input });
    expect(update).toHaveBeenCalledWith({ where: { id: "client-1" }, data: { name: "Ana Lima" } });
  });

  it("translates a unique violation on the document into a conflict (race between check and insert)", async () => {
    const create = jest.fn(async (_args: unknown) => { throw uniqueViolation; });
    const update = jest.fn(async (_args: unknown) => { throw uniqueViolation; });
    const repository = new PrismaClientRepository({ client: { create, update } } as never);

    await expect(repository.create(input)).rejects.toBeInstanceOf(ClientConflictError);
    await expect(repository.update("client-1", { document: "52998224725" })).rejects.toBeInstanceOf(ClientConflictError);
  });

  it("rethrows other database errors", async () => {
    const failure = new Error("connection lost");
    const create = jest.fn(async (_args: unknown) => { throw failure; });
    const repository = new PrismaClientRepository({ client: { create } } as never);

    await expect(repository.create(input)).rejects.toBe(failure);
  });

  it("soft deletes with an update and never performs physical deletion", async () => {
    const update = jest.fn(async (_args: unknown) => ({}));
    const repository = new PrismaClientRepository({ client: { update } } as never);

    await repository.softDelete("client-1");

    expect(update).toHaveBeenCalledWith({ where: { id: "client-1" }, data: { deletedAt: expect.any(Date) } });
  });

  it("counts only non-deleted events that are not in a terminal status", async () => {
    const count = jest.fn(async (_args: unknown) => 3);
    const repository = new PrismaClientRepository({ event: { count } } as never);

    await expect(repository.countOpenEvents("client-1")).resolves.toBe(3);
    expect(count).toHaveBeenCalledWith({
      where: { clientId: "client-1", deletedAt: null, status: { notIn: ["CONCLUIDO", "CANCELADO"] } },
    });
  });
});
