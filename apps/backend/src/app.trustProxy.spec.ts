import { beforeAll, describe, expect, it } from "@jest/globals";
import type { Express } from "express";
import request from "supertest";

describe("API behind a reverse proxy", () => {
  let app: Express;

  beforeAll(async () => {
    // Static imports are evaluated before this file's body (ESM), so the variable is set before a dynamic import.
    process.env.TRUST_PROXY = "1";
    ({ default: app } = await import("./app.js"));
  });

  it("trusts the configured number of proxy hops", () => {
    expect(app.get("trust proxy")).toBe(1);
  });

  it("does not reject requests forwarded by the proxy", async () => {
    const response = await request(app).get("/api/v1/health").set("X-Forwarded-For", "203.0.113.10");

    expect(response.status).toBe(200);
  });
});
