import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";

import { EventTeamController } from "./EventTeamController.js";

describe("EventTeamController", () => {
  it("assigns a team using route ids and authenticated actor", async () => {
    const assignTeamToEvent = jest.fn(async () => ({ eventId: "event-1", teamId: "team-1" }));
    const controller = new EventTeamController({ assignTeamToEvent } as never);
    const app = express();
    app.use((req, _res, next) => {
      req.user = { sub: "actor-1", email: "admin@buffet.local" };
      next();
    });
    app.post("/teams/:teamId/events/:eventId", controller.assignTeamToEvent);

    const response = await request(app).post("/teams/team-1/events/event-1");

    expect(response.status).toBe(201);
    expect(assignTeamToEvent).toHaveBeenCalledWith("event-1", "team-1", "actor-1");
  });

  it("rejects assignment without an authenticated actor", async () => {
    const assignTeamToEvent = jest.fn();
    const controller = new EventTeamController({ assignTeamToEvent } as never);
    const app = express();
    app.post("/teams/:teamId/events/:eventId", controller.assignTeamToEvent);

    const response = await request(app).post("/teams/team-1/events/event-1");

    expect(response.status).toBe(401);
    expect(assignTeamToEvent).not.toHaveBeenCalled();
  });

  it("unassigns a team using route ids and authenticated actor", async () => {
    const unassignTeamFromEvent = jest.fn(async () => undefined);
    const controller = new EventTeamController({ unassignTeamFromEvent } as never);
    const app = express();
    app.use((req, _res, next) => {
      req.user = { sub: "actor-1", email: "admin@buffet.local" };
      next();
    });
    app.delete("/teams/:teamId/events/:eventId", controller.unassignTeamFromEvent);

    const response = await request(app).delete("/teams/team-1/events/event-1");

    expect(response.status).toBe(204);
    expect(unassignTeamFromEvent).toHaveBeenCalledWith("event-1", "team-1", "actor-1");
  });

  it("rejects unassignment without an authenticated actor", async () => {
    const unassignTeamFromEvent = jest.fn();
    const controller = new EventTeamController({ unassignTeamFromEvent } as never);
    const app = express();
    app.delete("/teams/:teamId/events/:eventId", controller.unassignTeamFromEvent);

    const response = await request(app).delete("/teams/team-1/events/event-1");

    expect(response.status).toBe(401);
    expect(unassignTeamFromEvent).not.toHaveBeenCalled();
  });

  it("lists teams by event and events by team", async () => {
    const listTeamsByEvent = jest.fn(async () => [{ teamId: "team-1" }]);
    const listEventsByTeam = jest.fn(async () => [{ eventId: "event-1" }]);
    const controller = new EventTeamController({ listTeamsByEvent, listEventsByTeam } as never);
    const app = express();
    app.get("/events/:eventId/teams", controller.listTeamsByEvent);
    app.get("/teams/:teamId/events", controller.listEventsByTeam);

    const teamsResponse = await request(app).get("/events/event-1/teams");
    const eventsResponse = await request(app).get("/teams/team-1/events");

    expect(teamsResponse.status).toBe(200);
    expect(listTeamsByEvent).toHaveBeenCalledWith("event-1");
    expect(eventsResponse.status).toBe(200);
    expect(listEventsByTeam).toHaveBeenCalledWith("team-1");
  });
});
