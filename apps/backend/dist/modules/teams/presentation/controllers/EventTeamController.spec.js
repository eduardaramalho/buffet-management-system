import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";
import { EventTeamController } from "./EventTeamController.js";
describe("EventTeamController", () => {
    it("assigns a team using route ids and authenticated actor", async () => {
        const assignTeamToEvent = jest.fn(async () => ({ eventId: "event-1", teamId: "team-1" }));
        const controller = new EventTeamController({ assignTeamToEvent });
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
});
