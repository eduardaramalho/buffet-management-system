import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";

import { CollaboratorController } from "./CollaboratorController.js";

const authenticated = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  req.user = { sub: "actor-1", email: "admin@buffet.local" };
  next();
};

describe("CollaboratorController", () => {
  it("lists collaborators using the name query", async () => {
    const list = jest.fn(async () => []);
    const controller = new CollaboratorController({ list } as never);
    const app = express();
    app.get("/collaborators", controller.list);

    const response = await request(app).get("/collaborators?search=Ana");

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ search: "Ana" });
  });

  it("gets a collaborator by id", async () => {
    const get = jest.fn(async () => ({ id: "collaborator-1" }));
    const controller = new CollaboratorController({ get } as never);
    const app = express();
    app.get("/collaborators/:id", controller.get);

    const response = await request(app).get("/collaborators/collaborator-1");

    expect(response.status).toBe(200);
    expect(get).toHaveBeenCalledWith("collaborator-1");
  });

  it("creates a collaborator with the authenticated actor", async () => {
    const create = jest.fn(async (input: unknown) => ({ id: "collaborator-1", ...input }));
    const controller = new CollaboratorController({ create } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.post("/collaborators", controller.create);

    const response = await request(app).post("/collaborators").send({ name: "Ana", position: "Cozinheira" });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Ana", position: "Cozinheira" }), "actor-1");
  });

  it("rejects create without an authenticated actor", async () => {
    const create = jest.fn();
    const controller = new CollaboratorController({ create } as never);
    const app = express();
    app.use(express.json());
    app.post("/collaborators", controller.create);

    const response = await request(app).post("/collaborators").send({ name: "Ana", position: "Cozinheira" });

    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("updates a collaborator with the authenticated actor", async () => {
    const update = jest.fn(async () => ({ id: "collaborator-1", name: "Ana Souza" }));
    const controller = new CollaboratorController({ update } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.put("/collaborators/:id", controller.update);

    const response = await request(app).put("/collaborators/collaborator-1").send({ name: "Ana Souza" });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith("collaborator-1", { name: "Ana Souza", phone: null }, "actor-1");
  });

  it("rejects update without an authenticated actor", async () => {
    const update = jest.fn();
    const controller = new CollaboratorController({ update } as never);
    const app = express();
    app.use(express.json());
    app.put("/collaborators/:id", controller.update);

    const response = await request(app).put("/collaborators/collaborator-1").send({ name: "Ana Souza" });

    expect(response.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("changes a collaborator's status with the authenticated actor", async () => {
    const setActive = jest.fn(async () => ({ id: "collaborator-1", status: "INATIVO" }));
    const controller = new CollaboratorController({ setActive } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.patch("/collaborators/:id/status", controller.setStatus);

    const response = await request(app).patch("/collaborators/collaborator-1/status").send({ active: false });

    expect(response.status).toBe(200);
    expect(setActive).toHaveBeenCalledWith("collaborator-1", false, "actor-1");
  });

  it("rejects setStatus without an authenticated actor", async () => {
    const setActive = jest.fn();
    const controller = new CollaboratorController({ setActive } as never);
    const app = express();
    app.use(express.json());
    app.patch("/collaborators/:id/status", controller.setStatus);

    const response = await request(app).patch("/collaborators/collaborator-1/status").send({ active: false });

    expect(response.status).toBe(401);
    expect(setActive).not.toHaveBeenCalled();
  });
});
