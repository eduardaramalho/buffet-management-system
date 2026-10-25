import { Router } from "express";
import { eventController, eventReplicationController } from "../../infrastructure/factories/event.factory.js";
import { authenticate } from "../../../auth/presentation/middlewares/authenticate.js";
import { authorize } from "../../../auth/presentation/middlewares/authorize.js";

export const eventRoutes = Router();
eventRoutes.use(authenticate);
eventRoutes.get("/", authorize("events:list"), eventController.list);
// Declared before "/:id" so "deleted" is not taken as an event id.
eventRoutes.get("/deleted", authorize("events:restore"), eventController.listDeleted);
eventRoutes.get("/:id", authorize("events:read"), eventController.get);
eventRoutes.post("/", authorize("events:create"), eventController.create);
eventRoutes.put("/:id", authorize("events:update"), eventController.update);
eventRoutes.delete("/:id", authorize("events:delete"), eventController.remove);
eventRoutes.patch("/:id/restore", authorize("events:restore"), eventController.restore);
eventRoutes.post("/:id/services", authorize("events:update"), eventController.attachService);
eventRoutes.delete("/:id/services/:serviceId", authorize("events:update"), eventController.detachService);
// RF25: one permission covers preview and replication, which also copies manual tasks and allocates teams (ADR 0008).
eventRoutes.get("/:id/replication-preview", authorize("events:replicate"), eventReplicationController.preview);
eventRoutes.post("/:id/replicate", authorize("events:replicate"), eventReplicationController.replicate);