import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";
import { TeamController } from "./TeamController.js";
import { errorHandler } from "../../../../shared/middlewares/errorHandler.js";
const authenticated = (req, _res, next) => {
    req.user = { sub: "actor-1", email: "admin@buffet.local" };
    next();
};
describe("TeamController", () => {
    it("returns 422 for invalid team data", async () => {
        const controller = new TeamController({ create: jest.fn() });
        const app = express();
        app.use(express.json(), authenticated);
        app.post("/teams", controller.create);
        app.use(errorHandler);
        const response = await request(app).post("/teams").send({ name: "", specialty: "COZINHA" });
        expect(response.status).toBe(422);
    });
    it("creates a valid team with the authenticated actor", async () => {
        const create = jest.fn(async (input) => ({ id: "team-1", ...input }));
        const controller = new TeamController({ create });
        const app = express();
        app.use(express.json(), authenticated);
        app.post("/teams", controller.create);
        const response = await request(app).post("/teams").send({ name: "Equipe Salao A", specialty: "SALAO" });
        expect(response.status).toBe(201);
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Equipe Salao A", createdById: "actor-1" }));
    });
});
