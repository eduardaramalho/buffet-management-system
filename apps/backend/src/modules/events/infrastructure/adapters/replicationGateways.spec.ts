import { describe, expect, it, jest } from "@jest/globals";

import { createReplicationTaskStore, createReplicationTeamGateway } from "./replicationGateways.js";

describe("replication gateways (RF25 adapters)", () => {
  it("reads the event tasks through the task list filter and writes copies inside the transaction", async () => {
    const list = jest.fn(async (_filter: unknown) => []);
    const create = jest.fn(async (_input: unknown, _tx?: unknown) => ({ id: "task-1" }));
    const store = createReplicationTaskStore({ list, create } as never);
    const tx = { kind: "tx" };
    const input = { eventId: "replica-1", title: "T", description: null, dueDate: null, assignedTeamId: null, assignedAt: null, sourceRuleId: null, sourceTaskId: "task-0" };

    await store.listByEvent("source-1");
    await store.create(input, tx);

    expect(list).toHaveBeenCalledWith({ eventId: "source-1" });
    expect(create).toHaveBeenCalledWith(input, tx);
  });

  it("delegates team reads and availability, and allocates through the repository with the transaction", async () => {
    const findById = jest.fn(async (_id: string) => ({ id: "team-1", name: "Bar 1", specialty: "BAR" }));
    const listTeamsByEvent = jest.fn(async (_eventId: string) => [{ teamId: "team-1" }]);
    const checkAvailability = jest.fn(async (_teamId: string, _schedule: unknown) => ({ available: true as const }));
    const assign = jest.fn(async (_eventId: string, _teamId: string, _actorId: string, _tx?: unknown) => ({}));
    const gateway = createReplicationTeamGateway({ teams: { findById }, eventTeams: { listTeamsByEvent, checkAvailability }, assignments: { assign } });
    const schedule = { eventDate: new Date("2026-12-12T18:00:00.000Z"), endDate: null };
    const tx = { kind: "tx" };

    await expect(gateway.listTeamsByEvent("source-1")).resolves.toEqual([{ teamId: "team-1" }]);
    await expect(gateway.findTeam("team-1")).resolves.toEqual({ id: "team-1", name: "Bar 1", specialty: "BAR" });
    await expect(gateway.checkAvailability("team-1", schedule)).resolves.toEqual({ available: true });
    await gateway.assign("replica-1", "team-1", "actor-1", tx);

    expect(checkAvailability).toHaveBeenCalledWith("team-1", schedule);
    expect(assign).toHaveBeenCalledWith("replica-1", "team-1", "actor-1", tx);
  });
});
