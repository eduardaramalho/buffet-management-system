process.env.DATABASE_URL = "mysql://user:password@localhost:3306/buffet_test";
process.env.JWT_ACCESS_SECRET = "test-secret";
process.env.CORS_ORIGIN = "http://localhost:5173";

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import app from "../../../../app.js";
import { authService, tokenProvider } from "../../../auth/infrastructure/factories/auth.factory.js";
import { reportService } from "../../infrastructure/factories/report.factory.js";
import type { ExportRequest } from "../../application/ReportService.js";

const token = () => tokenProvider.createAccessToken({ sub: "actor-1", email: "admin@buffet.local" });
const auth = () => ({ Authorization: `Bearer ${token()}` });
const from = "2026-10-01T03:00:00.000Z";
const to = "2026-11-01T02:59:59.999Z";
const period = { from: new Date(from), to: new Date(to) };

describe("ReportController", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the events report with parsed filters and default pagination", async () => {
    const hasPermission = jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(reportService, "eventsReport").mockResolvedValue({ items: [] } as never);

    const response = await request(app)
      .get("/api/v1/reports/events")
      .query({ from, to, status: "CONFIRMADO", serviceType: "CASAMENTO", clientId: "client-1" })
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
    expect(reportService.eventsReport).toHaveBeenCalledWith(
      { ...period, status: "CONFIRMADO", serviceType: "CASAMENTO", clientId: "client-1" },
      { page: 1, pageSize: 20 },
    );
    expect(hasPermission).toHaveBeenCalledWith("actor-1", "reports:view");
  });

  it("returns the tasks report with explicit pagination and filters", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(reportService, "tasksReport").mockResolvedValue({ items: [] } as never);

    const response = await request(app)
      .get("/api/v1/reports/tasks")
      .query({ from, to, status: "PENDENTE", teamId: "team-1", origin: "MANUAL", page: "3", pageSize: "50" })
      .set(auth());

    expect(response.status).toBe(200);
    expect(reportService.tasksReport).toHaveBeenCalledWith({ ...period, status: "PENDENTE", teamId: "team-1", origin: "MANUAL" }, { page: 3, pageSize: 50 });
  });

  it("returns the team performance report for the period", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(reportService, "teamPerformanceReport").mockResolvedValue({ items: [] } as never);

    const response = await request(app).get("/api/v1/reports/teams-performance").query({ from, to }).set(auth());

    expect(response.status).toBe(200);
    expect(reportService.teamPerformanceReport).toHaveBeenCalledWith(period);
  });

  it.each([
    ["missing period", { from }],
    ["invalid date", { from: "ontem", to }],
    ["end before start", { from: to, to: from }],
    ["period longer than 366 days", { from: "2025-01-01T03:00:00.000Z", to: "2026-01-03T03:00:00.000Z" }],
    ["unknown status", { from, to, status: "ARQUIVADO" }],
    ["page size above the limit", { from, to, pageSize: "101" }],
    ["page zero", { from, to, page: "0" }],
  ])("rejects %s with 422", async (_case, query) => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    const eventsReport = jest.spyOn(reportService, "eventsReport");

    const response = await request(app).get("/api/v1/reports/events").query(query).set(auth());

    expect(response.status).toBe(422);
    expect(eventsReport).not.toHaveBeenCalled();
  });

  it("accepts a period of exactly 366 days", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(reportService, "teamPerformanceReport").mockResolvedValue({ items: [] } as never);

    const response = await request(app)
      .get("/api/v1/reports/teams-performance")
      .query({ from: "2028-01-01T03:00:00.000Z", to: "2029-01-01T03:00:00.000Z" })
      .set(auth());

    expect(response.status).toBe(200);
  });

  it.each<[string, ExportRequest, Record<string, string>]>([
    ["events", { kind: "events", filter: { ...period, status: "CONCLUIDO" } }, { status: "CONCLUIDO" }],
    ["tasks", { kind: "tasks", filter: { ...period, origin: "REGRA" } }, { origin: "REGRA" }],
    ["teams-performance", { kind: "teams-performance", filter: period }, {}],
  ])("exports the %s report as a downloadable file", async (path, expectedRequest, extraQuery) => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(reportService, "exportReport").mockResolvedValue({
      filename: "relatorio_2026-10-01_2026-10-31.csv",
      contentType: "text/csv; charset=utf-8",
      content: Buffer.from("a;b\r\n"),
    });

    const response = await request(app).get(`/api/v1/reports/${path}/export`).query({ from, to, format: "csv", ...extraQuery }).set(auth());

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(response.headers["content-disposition"]).toBe('attachment; filename="relatorio_2026-10-01_2026-10-31.csv"');
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.text).toBe("a;b\r\n");
    expect(reportService.exportReport).toHaveBeenCalledWith(expectedRequest, "csv", "actor-1");
  });

  it("rejects an export without a supported format", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    const exportReport = jest.spyOn(reportService, "exportReport");

    const response = await request(app).get("/api/v1/reports/events/export").query({ from, to, format: "xlsx" }).set(auth());

    expect(response.status).toBe(422);
    expect(exportReport).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/v1/reports/events").query({ from, to });

    expect(response.status).toBe(401);
  });

  it.each(["/events", "/events/export", "/tasks", "/tasks/export", "/teams-performance", "/teams-performance/export"])(
    "returns 403 on %s without reports:view",
    async (path) => {
      const hasPermission = jest.spyOn(authService, "hasPermission").mockResolvedValue(false);

      const response = await request(app).get(`/api/v1/reports${path}`).query({ from, to, format: "pdf" }).set(auth());

      expect(response.status).toBe(403);
      expect(hasPermission).toHaveBeenCalledWith("actor-1", "reports:view");
    },
  );
});
