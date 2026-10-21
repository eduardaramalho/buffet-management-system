import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";

import { TeamController } from "../modules/teams/presentation/controllers/TeamController.js";
import { CollaboratorController } from "../modules/teams/presentation/controllers/CollaboratorController.js";
import { EventController } from "../modules/events/presentation/controllers/EventController.js";
import { ServiceController } from "../modules/events/presentation/controllers/ServiceController.js";

const authenticated = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  req.user = { sub: "actor-1", email: "admin@buffet.local" };
  next();
};

const putPartial = async (handler: express.RequestHandler, body: object) => {
  const app = express();
  app.use(express.json(), authenticated);
  app.put("/items/:id", handler);
  await request(app).put("/items/item-1").send(body);
};

describe("partial PUT does not apply Zod defaults", () => {
  it("TeamController keeps observations untouched", async () => {
    const update = jest.fn(async () => ({}));
    await putPartial(new TeamController({ update } as never).update, { name: "Equipe" });
    expect(update).toHaveBeenCalledWith("item-1", { name: "Equipe" }, "actor-1");
  });

  it("CollaboratorController keeps phone untouched", async () => {
    const update = jest.fn(async () => ({}));
    await putPartial(new CollaboratorController({ update } as never).update, { name: "Ana" });
    expect(update).toHaveBeenCalledWith("item-1", { name: "Ana" }, "actor-1");
  });

  it("EventController keeps endDate and observations untouched", async () => {
    const update = jest.fn(async () => ({}));
    await putPartial(new EventController({ update } as never).update, { name: "Casamento" });
    expect(update).toHaveBeenCalledWith("item-1", { name: "Casamento" }, "actor-1");
  });

  it("ServiceController keeps isCustom untouched", async () => {
    const update = jest.fn(async () => ({}));
    await putPartial(new ServiceController({ update } as never).update, { name: "Bar" });
    expect(update).toHaveBeenCalledWith("item-1", { name: "Bar" }, "actor-1");
  });
});
