process.env.DATABASE_URL = "mysql://user:password@localhost:3306/buffet_test";
process.env.JWT_ACCESS_SECRET = "test-secret";
process.env.CORS_ORIGIN = "http://localhost:5173";
import { describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import app from "../../../../app.js";
import { authService, tokenProvider } from "../../../auth/infrastructure/factories/auth.factory.js";
import { eventService } from "../../infrastructure/factories/event.factory.js";
describe("EventController", () => {
    it("rejects invalid event payloads with Zod", async () => {
        jest.spyOn(authService, "hasPermission").mockResolvedValueOnce(true);
        const create = jest.spyOn(eventService, "create").mockResolvedValueOnce({});
        const token = tokenProvider.createAccessToken({ sub: "actor-1", email: "actor@buffet.com" });
        const response = await request(app)
            .post("/api/v1/events")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "x", serviceType: "INVALID", guestsCount: 0 });
        expect(response.status).toBe(422);
        expect(create).not.toHaveBeenCalled();
    });
    it("returns 403 when the authenticated user lacks events:list", async () => {
        jest.spyOn(authService, "hasPermission").mockResolvedValueOnce(false);
        const token = tokenProvider.createAccessToken({ sub: "actor-1", email: "actor@buffet.com" });
        const response = await request(app)
            .get("/api/v1/events")
            .set("Authorization", `Bearer ${token}`);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Permissão insuficiente" });
    });
});
