import { describe, expect, it, jest } from "@jest/globals";

import { PrismaTaskCommentRepository } from "./PrismaTaskCommentRepository.js";

const row = {
  id: "comment-1",
  taskId: "task-1",
  authorId: "actor-1",
  body: "Cliente confirmou",
  createdAt: new Date("2026-11-08T12:00:00.000Z"),
  deletedAt: null,
  author: { name: "Marina Costa" },
};
const record = {
  id: "comment-1",
  taskId: "task-1",
  authorId: "actor-1",
  authorName: "Marina Costa",
  body: "Cliente confirmou",
  createdAt: new Date("2026-11-08T12:00:00.000Z"),
};

describe("PrismaTaskCommentRepository", () => {
  it("lists the task's comments oldest first, without soft-deleted rows, with the author's name", async () => {
    const findMany = jest.fn(async (_input: unknown) => [row]);
    const repository = new PrismaTaskCommentRepository({ taskComment: { findMany } } as never);

    const result = await repository.listByTask("task-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { taskId: "task-1", deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true } } },
    });
    expect(result).toEqual([record]);
  });

  it("creates a comment and returns it with the author's name", async () => {
    const create = jest.fn(async (_input: unknown) => row);
    const repository = new PrismaTaskCommentRepository({ taskComment: { create } } as never);

    const result = await repository.create({ taskId: "task-1", authorId: "actor-1", body: "Cliente confirmou" });

    expect(create).toHaveBeenCalledWith({
      data: { taskId: "task-1", authorId: "actor-1", body: "Cliente confirmou" },
      include: { author: { select: { name: true } } },
    });
    expect(result).toEqual(record);
  });
});
