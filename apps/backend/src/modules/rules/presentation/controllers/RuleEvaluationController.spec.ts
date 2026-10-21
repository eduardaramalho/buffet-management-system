import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";

import { RuleEvaluationController } from "./RuleEvaluationController.js";
import { errorHandler } from "../../../../shared/middlewares/errorHandler.js";
import type { EventRecord } from "../../../events/domain/event.types.js";
import type { MatchedRule } from "../../domain/rule.types.js";

const makeEvent = (overrides: Partial<EventRecord> = {}): EventRecord => ({
  id: "event-1",
  name: "Casamento Ana e Bruno",
  eventDate: new Date("2026-12-01T18:00:00.000Z"),
  endDate: null,
  location: "Salão Jardim",
  serviceType: "CASAMENTO",
  guestsCount: 150,
  observations: null,
  status: "CONFIRMADO",
  createdById: "actor-1",
  createdAt: new Date("2026-09-28T00:00:00.000Z"),
  updatedAt: new Date("2026-09-28T00:00:00.000Z"),
  deletedAt: null,
  services: [{ serviceId: "service-bar", customLabel: null, service: { id: "service-bar", name: "Bar", isCustom: false, createdAt: new Date(), deletedAt: null } }],
  clientId: null,
  client: null,
  ...overrides,
});

describe("RuleEvaluationController", () => {
  it("resolves the event, extracts contracted service ids and returns the matched rules", async () => {
    const event = makeEvent();
    const matches: MatchedRule[] = [
      {
        rule: {
          id: "rule-1",
          name: "Casamento grande precisa de bar",
          description: null,
          isActive: true,
          conditionServiceTypeIn: ["CASAMENTO"],
          conditionMinGuests: 100,
          conditionMaxGuests: null,
          conditionRequiredServiceIds: ["service-bar"],
          createdById: "actor-1",
          createdAt: new Date("2026-09-28T00:00:00.000Z"),
          updatedAt: new Date("2026-09-28T00:00:00.000Z"),
          deletedAt: null,
          resourceRequirements: [{ id: "req-1", specialty: "BAR", minQuantity: 1 }],
          taskTemplates: [],
        },
        resourceRequirements: [{ id: "req-1", specialty: "BAR", minQuantity: 1 }],
      },
    ];
    const events = { findById: jest.fn(async () => event) };
    const evaluate = jest.fn(async () => matches);
    const controller = new RuleEvaluationController({ evaluate } as never, events as never);
    const app = express();
    app.get("/events/:eventId/rule-matches", controller.getMatches);

    const response = await request(app).get("/events/event-1/rule-matches");

    expect(events.findById).toHaveBeenCalledWith("event-1");
    expect(evaluate).toHaveBeenCalledWith({ serviceType: "CASAMENTO", guestsCount: 150 }, ["service-bar"]);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].rule.id).toBe("rule-1");
    expect(response.body[0].resourceRequirements).toEqual([{ id: "req-1", specialty: "BAR", minQuantity: 1 }]);
  });

  it("returns an empty list, not an error, when no rule matches", async () => {
    const events = { findById: jest.fn(async () => makeEvent({ services: [] })) };
    const evaluate = jest.fn(async () => []);
    const controller = new RuleEvaluationController({ evaluate } as never, events as never);
    const app = express();
    app.get("/events/:eventId/rule-matches", controller.getMatches);

    const response = await request(app).get("/events/event-1/rule-matches");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns 400 when the event does not exist", async () => {
    const events = { findById: jest.fn(async () => null) };
    const evaluate = jest.fn();
    const controller = new RuleEvaluationController({ evaluate } as never, events as never);
    const app = express();
    app.get("/events/:eventId/rule-matches", controller.getMatches);
    app.use(errorHandler);

    const response = await request(app).get("/events/missing/rule-matches");

    expect(response.status).toBe(400);
    expect(evaluate).not.toHaveBeenCalled();
  });
});
