import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";

import { RuleController } from "./RuleController.js";
import { errorHandler } from "../../../../shared/middlewares/errorHandler.js";

const authenticated = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  req.user = { sub: "actor-1", email: "admin@buffet.local" };
  next();
};

describe("RuleController", () => {
  it("returns 422 for invalid rule data", async () => {
    const controller = new RuleController({ create: jest.fn() } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.post("/rules", controller.create);
    app.use(errorHandler);

    const response = await request(app).post("/rules").send({ name: "" });

    expect(response.status).toBe(422);
  });

  it("creates a valid rule with the authenticated actor", async () => {
    const create = jest.fn(async (input: unknown) => ({ id: "rule-1", ...input }));
    const controller = new RuleController({ create } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.post("/rules", controller.create);

    const response = await request(app)
      .post("/rules")
      .send({ name: "Casamento grande", resourceRequirements: [{ specialty: "BAR", minQuantity: 1 }] });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Casamento grande", createdById: "actor-1" }));
  });

  it("rejects create without an authenticated actor", async () => {
    const create = jest.fn();
    const controller = new RuleController({ create } as never);
    const app = express();
    app.use(express.json());
    app.post("/rules", controller.create);

    const response = await request(app).post("/rules").send({ name: "Casamento grande" });

    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("lists and gets rules", async () => {
    const list = jest.fn(async () => [{ id: "rule-1" }]);
    const get = jest.fn(async () => ({ id: "rule-1" }));
    const controller = new RuleController({ list, get } as never);
    const app = express();
    app.get("/rules", controller.list);
    app.get("/rules/:id", controller.get);

    await request(app).get("/rules?search=Casamento&isActive=true");
    const response = await request(app).get("/rules/rule-1");

    expect(list).toHaveBeenCalledWith({ search: "Casamento", isActive: true });
    expect(response.status).toBe(200);
    expect(get).toHaveBeenCalledWith("rule-1");
  });

  it("updates a rule with the authenticated actor", async () => {
    const update = jest.fn(async () => ({ id: "rule-1", name: "Regra atualizada" }));
    const controller = new RuleController({ update } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.put("/rules/:id", controller.update);

    const response = await request(app).put("/rules/rule-1").send({ name: "Regra atualizada" });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith("rule-1", expect.objectContaining({ name: "Regra atualizada" }), "actor-1");
  });

  it("preserves templates when taskTemplates is omitted from PUT", async () => {
    const update = jest.fn(async () => ({ id: "rule-1" }));
    const controller = new RuleController({ update } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.put("/rules/:id", controller.update);

    await request(app).put("/rules/rule-1").send({ name: "Regra atualizada" });

    expect(update).toHaveBeenCalledWith("rule-1", expect.not.objectContaining({ taskTemplates: expect.anything() }), "actor-1");
  });

  it("passes an empty taskTemplates list to PUT to remove all templates", async () => {
    const update = jest.fn(async () => ({ id: "rule-1" }));
    const controller = new RuleController({ update } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.put("/rules/:id", controller.update);

    await request(app).put("/rules/rule-1").send({ taskTemplates: [] });

    expect(update).toHaveBeenCalledWith("rule-1", expect.objectContaining({ taskTemplates: [] }), "actor-1");
  });

  it("does not apply Zod defaults to omitted fields on partial PUT", async () => {
    const update = jest.fn(async () => ({ id: "rule-1" }));
    const controller = new RuleController({ update } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.put("/rules/:id", controller.update);

    await request(app).put("/rules/rule-1").send({ name: "Só o nome" });

    expect(update).toHaveBeenCalledWith("rule-1", { name: "Só o nome" }, "actor-1");
  });

  it("returns 400 for an empty task template title", async () => {
    const controller = new RuleController({ create: jest.fn() } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.post("/rules", controller.create);
    app.use(errorHandler);

    const response = await request(app).post("/rules").send({ name: "Regra", taskTemplates: [{ title: "" }] });

    expect(response.status).toBe(400);
  });

  it("returns 400 for a negative daysBeforeEvent", async () => {
    const controller = new RuleController({ create: jest.fn() } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.post("/rules", controller.create);
    app.use(errorHandler);

    const response = await request(app).post("/rules").send({ name: "Regra", taskTemplates: [{ title: "Preparar", daysBeforeEvent: -1 }] });

    expect(response.status).toBe(400);
  });

  it("rejects update without an authenticated actor", async () => {
    const update = jest.fn();
    const controller = new RuleController({ update } as never);
    const app = express();
    app.use(express.json());
    app.put("/rules/:id", controller.update);

    const response = await request(app).put("/rules/rule-1").send({ name: "Regra atualizada" });

    expect(response.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("removes a rule with the authenticated actor", async () => {
    const remove = jest.fn(async () => undefined);
    const controller = new RuleController({ remove } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.delete("/rules/:id", controller.remove);

    const response = await request(app).delete("/rules/rule-1");

    expect(response.status).toBe(204);
    expect(remove).toHaveBeenCalledWith("rule-1", "actor-1");
  });

  it("rejects remove without an authenticated actor", async () => {
    const remove = jest.fn();
    const controller = new RuleController({ remove } as never);
    const app = express();
    app.use(express.json());
    app.delete("/rules/:id", controller.remove);

    const response = await request(app).delete("/rules/rule-1");

    expect(response.status).toBe(401);
    expect(remove).not.toHaveBeenCalled();
  });

  it("activates and deactivates a rule with the authenticated actor", async () => {
    const setActive = jest.fn(async (id: string, isActive: boolean) => ({ id, isActive }));
    const controller = new RuleController({ setActive } as never);
    const app = express();
    app.use(express.json(), authenticated);
    app.patch("/rules/:id/activate", controller.setActive(true));
    app.patch("/rules/:id/deactivate", controller.setActive(false));

    const activated = await request(app).patch("/rules/rule-1/activate");
    const deactivated = await request(app).patch("/rules/rule-1/deactivate");

    expect(activated.status).toBe(200);
    expect(setActive).toHaveBeenNthCalledWith(1, "rule-1", true, "actor-1");
    expect(deactivated.status).toBe(200);
    expect(setActive).toHaveBeenNthCalledWith(2, "rule-1", false, "actor-1");
  });

  it("rejects setActive without an authenticated actor", async () => {
    const setActive = jest.fn();
    const controller = new RuleController({ setActive } as never);
    const app = express();
    app.use(express.json());
    app.patch("/rules/:id/activate", controller.setActive(true));

    const response = await request(app).patch("/rules/rule-1/activate");

    expect(response.status).toBe(401);
    expect(setActive).not.toHaveBeenCalled();
  });
});
