import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";

import { RuleApplicationController } from "./RuleApplicationController.js";

describe("RuleApplicationController", () => {
  it("lists applications for an event", async () => {
    const listByEvent = jest.fn(async () => [{ ruleId: "rule-1", ruleName: "Regra", appliedAt: new Date("2026-10-02") }]);
    const controller = new RuleApplicationController({ applyRules: jest.fn() } as never, { listByEvent } as never);
    const app = express();
    app.get("/events/:eventId/rule-applications", controller.list);

    const response = await request(app).get("/events/event-1/rule-applications");

    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual({ ruleId: "rule-1", ruleName: "Regra", appliedAt: "2026-10-02T00:00:00.000Z" });
  });

  it("applies rules for the given event using the authenticated actor", async () => {
    const applyRules = jest.fn(async () => ({ tasksCreated: 1, teamsAutoAssigned: 1, alertsGenerated: 0 }));
    const controller = new RuleApplicationController({ applyRules } as never);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { sub: "actor-1", email: "admin@buffet.local" };
      next();
    });
    app.post("/events/:eventId/apply-rules", controller.apply);

    const response = await request(app).post("/events/event-1/apply-rules").send({});

    expect(applyRules).toHaveBeenCalledWith("event-1", "actor-1", { forceRuleId: undefined });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ tasksCreated: 1, teamsAutoAssigned: 1, alertsGenerated: 0 });
  });

  it("passes forceRuleId through for forced reprocessing", async () => {
    const applyRules = jest.fn(async () => ({ tasksCreated: 1, teamsAutoAssigned: 0, alertsGenerated: 0 }));
    const controller = new RuleApplicationController({ applyRules } as never);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { sub: "actor-1", email: "admin@buffet.local" };
      next();
    });
    app.post("/events/:eventId/apply-rules", controller.apply);

    await request(app).post("/events/event-1/apply-rules").send({ forceRuleId: "rule-1" });

    expect(applyRules).toHaveBeenCalledWith("event-1", "actor-1", { forceRuleId: "rule-1" });
  });

  it("returns 401 when there is no authenticated actor", async () => {
    const applyRules = jest.fn();
    const controller = new RuleApplicationController({ applyRules } as never);
    const app = express();
    app.use(express.json());
    app.post("/events/:eventId/apply-rules", controller.apply);

    const response = await request(app).post("/events/event-1/apply-rules").send({});

    expect(response.status).toBe(401);
    expect(applyRules).not.toHaveBeenCalled();
  });
});
