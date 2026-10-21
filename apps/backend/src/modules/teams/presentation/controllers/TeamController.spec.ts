import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";

import { TeamController } from "./TeamController.js";
import { errorHandler } from "../../../../shared/middlewares/errorHandler.js";

const authenticated = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  req.user = { sub: "actor-1", email: "admin@buffet.local" };
  next();
};

describe("TeamController", () => {
  it("returns 422 for invalid team data", async () => {
    const controller = new TeamController({ create: jest.fn() } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.post("/teams", controller.create);
    app.use(errorHandler);

    const response = await request(app).post("/teams").send({ name: "", specialty: "COZINHA" });

    expect(response.status).toBe(422);
  });

  it("creates a valid team with the authenticated actor", async () => {
    const create = jest.fn(async (input: unknown) => ({ id: "team-1", ...input }));
    const controller = new TeamController({ create } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.post("/teams", controller.create);

    const response = await request(app).post("/teams").send({ name: "Equipe Salao A", specialty: "SALAO" });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Equipe Salao A", createdById: "actor-1" }));
  });

  it("rejects create without an authenticated actor", async () => {
    const create = jest.fn();
    const controller = new TeamController({ create } as never);
    const app = express();
    app.use(express.json());
    app.post("/teams", controller.create);

    const response = await request(app).post("/teams").send({ name: "Equipe Salao A", specialty: "SALAO" });

    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("lists and gets teams", async () => {
    const list = jest.fn(async () => [{ id: "team-1" }]);
    const get = jest.fn(async () => ({ id: "team-1" }));
    const controller = new TeamController({ list, get } as never);
    const app = express();
    app.get("/teams", controller.list);
    app.get("/teams/:id", controller.get);

    await request(app).get("/teams?search=Cozinha&status=ATIVA");
    const response = await request(app).get("/teams/team-1");

    expect(list).toHaveBeenCalledWith({ search: "Cozinha", status: "ATIVA" });
    expect(response.status).toBe(200);
    expect(get).toHaveBeenCalledWith("team-1");
  });

  it("updates a team with the authenticated actor", async () => {
    const update = jest.fn(async () => ({ id: "team-1", name: "Equipe Cozinha B" }));
    const controller = new TeamController({ update } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.put("/teams/:id", controller.update);

    const response = await request(app).put("/teams/team-1").send({ name: "Equipe Cozinha B" });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith("team-1", { name: "Equipe Cozinha B" }, "actor-1");
  });

  it("rejects update without an authenticated actor", async () => {
    const update = jest.fn();
    const controller = new TeamController({ update } as never);
    const app = express();
    app.use(express.json());
    app.put("/teams/:id", controller.update);

    const response = await request(app).put("/teams/team-1").send({ name: "Equipe Cozinha B" });

    expect(response.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("removes a team with the authenticated actor", async () => {
    const remove = jest.fn(async () => undefined);
    const controller = new TeamController({ remove } as never);
    const app = express();
    app.use(authenticated);
    app.delete("/teams/:id", controller.remove);

    const response = await request(app).delete("/teams/team-1");

    expect(response.status).toBe(204);
    expect(remove).toHaveBeenCalledWith("team-1", "actor-1");
  });

  it("rejects remove without an authenticated actor", async () => {
    const remove = jest.fn();
    const controller = new TeamController({ remove } as never);
    const app = express();
    app.delete("/teams/:id", controller.remove);

    const response = await request(app).delete("/teams/team-1");

    expect(response.status).toBe(401);
    expect(remove).not.toHaveBeenCalled();
  });

  it("adds and removes a member with the authenticated actor", async () => {
    const addMember = jest.fn(async () => ({ id: "team-1" }));
    const removeMember = jest.fn(async () => undefined);
    const controller = new TeamController({ addMember, removeMember } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.post("/teams/:id/members", controller.addMember);
    app.delete("/teams/:id/members/:collaboratorId", controller.removeMember);

    const addResponse = await request(app).post("/teams/team-1/members").send({ collaboratorId: "collaborator-1" });
    const removeResponse = await request(app).delete("/teams/team-1/members/collaborator-1");

    expect(addResponse.status).toBe(200);
    expect(addMember).toHaveBeenCalledWith("team-1", "collaborator-1", false, "actor-1");
    expect(removeResponse.status).toBe(204);
    expect(removeMember).toHaveBeenCalledWith("team-1", "collaborator-1", "actor-1");
  });

  it("rejects addMember and removeMember without an authenticated actor", async () => {
    const addMember = jest.fn();
    const removeMember = jest.fn();
    const controller = new TeamController({ addMember, removeMember } as never);
    const app = express();
    app.use(express.json());
    app.post("/teams/:id/members", controller.addMember);
    app.delete("/teams/:id/members/:collaboratorId", controller.removeMember);

    const addResponse = await request(app).post("/teams/team-1/members").send({ collaboratorId: "collaborator-1" });
    const removeResponse = await request(app).delete("/teams/team-1/members/collaborator-1");

    expect(addResponse.status).toBe(401);
    expect(removeResponse.status).toBe(401);
    expect(addMember).not.toHaveBeenCalled();
    expect(removeMember).not.toHaveBeenCalled();
  });

  it("activates and deactivates a team with the authenticated actor", async () => {
    const setActive = jest.fn(async (_id: string, active: boolean) => ({ id: "team-1", status: active ? "ATIVA" : "INATIVA" }));
    const controller = new TeamController({ setActive } as never);
    const app = express();
    app.use(authenticated);
    app.patch("/teams/:id/activate", controller.setActive(true));
    app.patch("/teams/:id/deactivate", controller.setActive(false));

    const activateResponse = await request(app).patch("/teams/team-1/activate");
    const deactivateResponse = await request(app).patch("/teams/team-1/deactivate");

    expect(activateResponse.status).toBe(200);
    expect(setActive).toHaveBeenNthCalledWith(1, "team-1", true, "actor-1");
    expect(deactivateResponse.status).toBe(200);
    expect(setActive).toHaveBeenNthCalledWith(2, "team-1", false, "actor-1");
  });

  it("rejects setActive without an authenticated actor", async () => {
    const setActive = jest.fn();
    const controller = new TeamController({ setActive } as never);
    const app = express();
    app.patch("/teams/:id/activate", controller.setActive(true));

    const response = await request(app).patch("/teams/team-1/activate");

    expect(response.status).toBe(401);
    expect(setActive).not.toHaveBeenCalled();
  });
});
