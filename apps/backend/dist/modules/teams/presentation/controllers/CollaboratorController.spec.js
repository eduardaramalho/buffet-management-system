import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";
import { CollaboratorController } from "./CollaboratorController.js";
describe("CollaboratorController", () => {
    it("lists collaborators using the name query", async () => {
        const list = jest.fn(async () => []);
        const controller = new CollaboratorController({ list });
        const app = express();
        app.get("/collaborators", controller.list);
        const response = await request(app).get("/collaborators?search=Ana");
        expect(response.status).toBe(200);
        expect(list).toHaveBeenCalledWith({ search: "Ana" });
    });
});
