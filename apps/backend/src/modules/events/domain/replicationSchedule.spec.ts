import { describe, expect, it } from "@jest/globals";

import { isBefore, shiftDueDate } from "./replicationSchedule.js";

describe("shiftDueDate (RF25: recalculated deadline of a copied manual task)", () => {
  const sourceEventDate = new Date("2026-06-20T18:00:00.000Z");
  const newEventDate = new Date("2026-12-12T18:00:00.000Z");

  it("keeps a task without deadline without deadline", () => {
    expect(shiftDueDate(null, sourceEventDate, newEventDate)).toBeNull();
  });

  it("keeps the same distance to the event when the deadline is before it", () => {
    const dueDate = new Date("2026-06-13T09:30:00.000Z"); // 7 days and 8h30 before the source event

    expect(shiftDueDate(dueDate, sourceEventDate, newEventDate)).toEqual(new Date("2026-12-05T09:30:00.000Z"));
  });

  it("keeps the same distance to the event when the deadline is after it (post-event tasks)", () => {
    const dueDate = new Date("2026-06-21T12:00:00.000Z");

    expect(shiftDueDate(dueDate, sourceEventDate, newEventDate)).toEqual(new Date("2026-12-13T12:00:00.000Z"));
  });

  it("moves the deadline backwards when the new event is earlier than the source", () => {
    const dueDate = new Date("2026-06-10T18:00:00.000Z");

    expect(shiftDueDate(dueDate, sourceEventDate, new Date("2026-03-01T18:00:00.000Z"))).toEqual(new Date("2026-02-19T18:00:00.000Z"));
  });

  it("does not mutate the original date", () => {
    const dueDate = new Date("2026-06-13T09:30:00.000Z");
    shiftDueDate(dueDate, sourceEventDate, newEventDate);

    expect(dueDate.toISOString()).toBe("2026-06-13T09:30:00.000Z");
  });
});

describe("isBefore", () => {
  it("flags only dates strictly before the reference", () => {
    const now = new Date("2026-10-23T12:00:00.000Z");

    expect(isBefore(new Date("2026-10-23T11:59:59.000Z"), now)).toBe(true);
    expect(isBefore(now, now)).toBe(false);
    expect(isBefore(null, now)).toBe(false);
  });
});
