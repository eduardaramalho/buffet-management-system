import { describe, expect, it, jest } from "@jest/globals";

import { ReportService } from "./ReportService.js";
import type {
  EventReportRow,
  ReportAuditService,
  ReportDocument,
  ReportExporter,
  ReportRepository,
  TaskReportRecord,
  TeamPerformanceAggregate,
} from "../domain/report.types.js";

const NOW = new Date("2026-10-21T15:00:00.000Z");
const period = { from: new Date("2026-10-01T03:00:00.000Z"), to: new Date("2026-11-01T02:59:59.999Z") };

const eventRow = (overrides: Partial<EventReportRow> = {}): EventReportRow => ({
  id: "event-1",
  name: "Casamento Ana",
  eventDate: new Date("2026-10-10T22:00:00.000Z"),
  status: "CONFIRMADO",
  serviceType: "CASAMENTO",
  guestsCount: 120,
  clientName: "Ana",
  tasksTotal: 4,
  tasksCompleted: 1,
  ...overrides,
});

const taskRecord = (overrides: Partial<TaskReportRecord> = {}): TaskReportRecord => ({
  id: "task-1",
  title: "Comprar insumos",
  status: "PENDENTE",
  dueDate: new Date("2026-10-20T12:00:00.000Z"),
  completedAt: null,
  createdAt: new Date("2026-10-01T12:00:00.000Z"),
  assignedAt: null,
  sourceRuleId: "rule-1",
  eventId: "event-1",
  eventName: "Casamento Ana",
  eventDate: new Date("2026-10-25T22:00:00.000Z"),
  teamName: null,
  ...overrides,
});

const teamAggregate = (overrides: Partial<TeamPerformanceAggregate> = {}): TeamPerformanceAggregate => ({
  teamId: "team-1",
  teamName: "Cozinha A",
  specialty: "COZINHA",
  total: 10,
  completed: 6,
  completedOnTime: 3,
  completedLate: 1,
  overdueOpen: 2,
  canceled: 1,
  ruleAssignedCount: 2,
  ruleAssignmentSeconds: 7200,
  manualAssignedCount: 4,
  manualAssignmentSeconds: 0,
  ...overrides,
});

function makeRepository(overrides: Partial<ReportRepository> = {}): jest.Mocked<ReportRepository> {
  return {
    eventAggregates: jest.fn(async () => ({ byStatus: [], byServiceType: [] })),
    eventRows: jest.fn(async () => []),
    taskAggregates: jest.fn(async () => ({ byStatus: [], manualCount: 0, overdueOpen: 0, completedOnTime: 0, completedLate: 0 })),
    taskRows: jest.fn(async () => []),
    teamPerformance: jest.fn(async () => []),
    ...overrides,
  } as jest.Mocked<ReportRepository>;
}

function makeExporter(extension: string, contentType: string) {
  const render = jest.fn(async (_document: ReportDocument) => Buffer.from(extension));
  return { exporter: { extension, contentType, render } as ReportExporter, render };
}

function makeService(repository: ReportRepository) {
  const csv = makeExporter("csv", "text/csv; charset=utf-8");
  const pdf = makeExporter("pdf", "application/pdf");
  const record = jest.fn(async (_input: Parameters<ReportAuditService["record"]>[0]) => undefined);
  const service = new ReportService(repository, { csv: csv.exporter, pdf: pdf.exporter }, { record }, () => NOW);
  return { service, csvRender: csv.render, pdfRender: pdf.render, record };
}

describe("ReportService.eventsReport", () => {
  it("fills every status and service type with zero and derives the total from the aggregates", async () => {
    const repository = makeRepository({
      eventAggregates: jest.fn(async () => ({
        byStatus: [{ status: "CONFIRMADO" as const, count: 2 }, { status: "CANCELADO" as const, count: 1 }],
        byServiceType: [{ serviceType: "CASAMENTO" as const, count: 3 }],
      })),
      eventRows: jest.fn(async () => [eventRow()]),
    });
    const { service } = makeService(repository);

    const report = await service.eventsReport({ ...period, status: "CONFIRMADO" }, { page: 1, pageSize: 20 });

    expect(report.summary).toEqual({
      total: 3,
      byStatus: { PLANEJAMENTO: 0, CONFIRMADO: 2, EM_ANDAMENTO: 0, CONCLUIDO: 0, CANCELADO: 1 },
      byServiceType: { CASAMENTO: 3, ANIVERSARIO: 0, FORMATURA: 0, CORPORATIVO: 0, CONFRATERNIZACAO: 0, BATIZADO: 0, OUTRO: 0 },
    });
    expect(report.items).toEqual([eventRow()]);
    expect(report.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 3, totalPages: 1 });
    expect(report.period).toEqual(period);
    expect(repository.eventAggregates).toHaveBeenCalledWith({ ...period, status: "CONFIRMADO" });
    expect(repository.eventRows).toHaveBeenCalledWith({ ...period, status: "CONFIRMADO" }, { page: 1, pageSize: 20 });
  });

  it("does not query rows when the period has no events", async () => {
    const repository = makeRepository();
    const { service } = makeService(repository);

    const report = await service.eventsReport(period, { page: 1, pageSize: 20 });

    expect(report.items).toEqual([]);
    expect(report.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    expect(repository.eventRows).not.toHaveBeenCalled();
  });
});

describe("ReportService.tasksReport", () => {
  it("summarizes by status and origin and computes on-time percentage excluding canceled tasks", async () => {
    const repository = makeRepository({
      taskAggregates: jest.fn(async () => ({
        byStatus: [{ status: "PENDENTE" as const, count: 4 }, { status: "CONCLUIDA" as const, count: 4 }, { status: "CANCELADA" as const, count: 2 }],
        manualCount: 3,
        overdueOpen: 2,
        completedOnTime: 3,
        completedLate: 1,
      })),
      taskRows: jest.fn(async () => [taskRecord()]),
    });
    const { service } = makeService(repository);

    const report = await service.tasksReport({ ...period, origin: "REGRA" }, { page: 2, pageSize: 4 });

    expect(report.summary).toEqual({
      total: 10,
      byStatus: { PENDENTE: 4, EM_ANDAMENTO: 0, CONCLUIDA: 4, CANCELADA: 2 },
      byOrigin: { REGRA: 7, MANUAL: 3 },
      overdueOpen: 2,
      completedOnTime: 3,
      completedLate: 1,
      canceled: 2,
      onTimePercentage: 75,
    });
    expect(report.pagination).toEqual({ page: 2, pageSize: 4, totalItems: 10, totalPages: 3 });
    expect(repository.taskAggregates).toHaveBeenCalledWith({ ...period, origin: "REGRA" }, NOW);
    expect(repository.taskRows).toHaveBeenCalledWith({ ...period, origin: "REGRA" }, { page: 2, pageSize: 4 });
  });

  it("returns a null on-time percentage when no task has a measurable deadline", async () => {
    const { service } = makeService(makeRepository());

    const report = await service.tasksReport(period, { page: 1, pageSize: 20 });

    expect(report.summary.onTimePercentage).toBeNull();
    expect(report.summary.total).toBe(0);
  });

  it("flags origin, overdue open tasks and late completions on each row", async () => {
    const repository = makeRepository({
      taskAggregates: jest.fn(async () => ({ byStatus: [{ status: "PENDENTE" as const, count: 5 }], manualCount: 0, overdueOpen: 0, completedOnTime: 0, completedLate: 0 })),
      taskRows: jest.fn(async () => [
        taskRecord({ id: "overdue" }),
        taskRecord({ id: "future", dueDate: new Date("2026-10-30T12:00:00.000Z"), status: "EM_ANDAMENTO" }),
        taskRecord({ id: "no-due", dueDate: null, sourceRuleId: null }),
        taskRecord({ id: "late", status: "CONCLUIDA", completedAt: new Date("2026-10-21T12:00:00.000Z") }),
        taskRecord({ id: "canceled", status: "CANCELADA" }),
      ]),
    });
    const { service } = makeService(repository);

    const { items } = await service.tasksReport(period, { page: 1, pageSize: 20 });

    expect(items.map(({ id, origin, overdue, completedLate }) => ({ id, origin, overdue, completedLate }))).toEqual([
      { id: "overdue", origin: "REGRA", overdue: true, completedLate: false },
      { id: "future", origin: "REGRA", overdue: false, completedLate: false },
      { id: "no-due", origin: "MANUAL", overdue: false, completedLate: false },
      { id: "late", origin: "REGRA", overdue: false, completedLate: true },
      { id: "canceled", origin: "REGRA", overdue: false, completedLate: false },
    ]);
    expect(items[0]).not.toHaveProperty("sourceRuleId");
  });
});

describe("ReportService.teamPerformanceReport", () => {
  it("derives per-team percentages and average assignment minutes by origin", async () => {
    const repository = makeRepository({ teamPerformance: jest.fn(async () => [teamAggregate()]) });
    const { service } = makeService(repository);

    const report = await service.teamPerformanceReport(period);

    expect(report.items).toEqual([{
      teamId: "team-1",
      teamName: "Cozinha A",
      specialty: "COZINHA",
      total: 10,
      completed: 6,
      completedOnTime: 3,
      completedLate: 1,
      overdueOpen: 2,
      canceled: 1,
      onTimePercentage: 75,
      avgAssignmentMinutes: { REGRA: 60, MANUAL: 0 },
    }]);
    expect(repository.teamPerformance).toHaveBeenCalledWith(period, NOW);
  });

  it("weights the overall averages by the number of assigned tasks of each team", async () => {
    const repository = makeRepository({
      teamPerformance: jest.fn(async () => [
        teamAggregate(),
        teamAggregate({
          teamId: "team-2",
          teamName: "Salão",
          specialty: "SALAO",
          total: 5,
          completedOnTime: 0,
          completedLate: 0,
          overdueOpen: 0,
          canceled: 0,
          ruleAssignedCount: 1,
          ruleAssignmentSeconds: 9000,
          manualAssignedCount: 0,
          manualAssignmentSeconds: 0,
        }),
      ]),
    });
    const { service } = makeService(repository);

    const report = await service.teamPerformanceReport(period);

    expect(report.items[1].onTimePercentage).toBeNull();
    expect(report.items[1].avgAssignmentMinutes).toEqual({ REGRA: 150, MANUAL: null });
    expect(report.summary).toEqual({
      teams: 2,
      tasks: 15,
      completedOnTime: 3,
      completedLate: 1,
      overdueOpen: 2,
      canceled: 1,
      onTimePercentage: 75,
      avgAssignmentMinutes: { REGRA: 90, MANUAL: 0 },
    });
  });

  it("returns empty summary values when no team has tasks in the period", async () => {
    const { service } = makeService(makeRepository());

    const report = await service.teamPerformanceReport(period);

    expect(report.summary).toEqual({
      teams: 0,
      tasks: 0,
      completedOnTime: 0,
      completedLate: 0,
      overdueOpen: 0,
      canceled: 0,
      onTimePercentage: null,
      avgAssignmentMinutes: { REGRA: null, MANUAL: null },
    });
  });
});

describe("ReportService.exportReport", () => {
  it("exports every event row of the period as CSV and audits the export", async () => {
    const repository = makeRepository({
      eventAggregates: jest.fn(async () => ({ byStatus: [{ status: "CONFIRMADO" as const, count: 1 }], byServiceType: [{ serviceType: "CASAMENTO" as const, count: 1 }] })),
      eventRows: jest.fn(async () => [eventRow({ clientName: null })]),
    });
    const { service, csvRender, record } = makeService(repository);

    const file = await service.exportReport({ kind: "events", filter: { ...period, status: "CONFIRMADO" } }, "csv", "actor-1");

    expect(repository.eventRows).toHaveBeenCalledWith({ ...period, status: "CONFIRMADO" });
    expect(file).toEqual({
      filename: "relatorio-eventos_2026-10-01_2026-10-31.csv",
      contentType: "text/csv; charset=utf-8",
      content: Buffer.from("csv"),
    });
    const document = csvRender.mock.calls[0][0];
    expect(document.title).toBe("Relatório de eventos");
    expect(document.periodLabel).toBe("01/10/2026 a 31/10/2026");
    expect(document.generatedAtLabel).toBe("21/10/2026 12:00");
    expect(document.columns).toEqual(["Data", "Evento", "Cliente", "Tipo", "Status", "Convidados", "Tarefas", "Concluídas"]);
    expect(document.rows).toEqual([["10/10/2026 19:00", "Casamento Ana", null, "Casamento", "Confirmado", 120, 4, 1]]);
    expect(document.summary).toEqual(expect.arrayContaining([{ label: "Total de eventos", value: 1 }, { label: "Confirmado", value: 1 }]));
    expect(record).toHaveBeenCalledWith({
      userId: "actor-1",
      action: "REPORT_EXPORTED",
      entity: "Report",
      changes: { kind: "events", format: "csv", rows: 1, filter: { ...period, status: "CONFIRMADO" } },
    });
  });

  it("exports tasks as PDF with origin, team and situation labels", async () => {
    const repository = makeRepository({
      taskAggregates: jest.fn(async () => ({ byStatus: [{ status: "PENDENTE" as const, count: 2 }], manualCount: 1, overdueOpen: 1, completedOnTime: 0, completedLate: 0 })),
      taskRows: jest.fn(async () => [
        taskRecord(),
        taskRecord({ id: "task-2", sourceRuleId: null, dueDate: null, teamName: "Cozinha A", status: "CONCLUIDA", completedAt: new Date("2026-10-02T12:00:00.000Z") }),
        taskRecord({ id: "task-3", status: "CONCLUIDA", completedAt: new Date("2026-10-21T12:00:00.000Z") }),
        taskRecord({ id: "task-4", status: "CONCLUIDA", completedAt: new Date("2026-10-19T12:00:00.000Z") }),
      ]),
    });
    const { service, pdfRender } = makeService(repository);

    const file = await service.exportReport({ kind: "tasks", filter: period }, "pdf", "actor-1");

    expect(file.filename).toBe("relatorio-tarefas_2026-10-01_2026-10-31.pdf");
    expect(file.contentType).toBe("application/pdf");
    const document = pdfRender.mock.calls[0][0];
    expect(document.columns).toEqual(["Evento", "Data do evento", "Tarefa", "Origem", "Equipe", "Status", "Prazo", "Concluída em", "Situação"]);
    expect(document.rows).toEqual([
      ["Casamento Ana", "25/10/2026 19:00", "Comprar insumos", "Regra", null, "Pendente", "20/10/2026 09:00", null, "Atrasada"],
      ["Casamento Ana", "25/10/2026 19:00", "Comprar insumos", "Manual", "Cozinha A", "Concluída", null, "02/10/2026 09:00", null],
      ["Casamento Ana", "25/10/2026 19:00", "Comprar insumos", "Regra", null, "Concluída", "20/10/2026 09:00", "21/10/2026 09:00", "Concluída com atraso"],
      ["Casamento Ana", "25/10/2026 19:00", "Comprar insumos", "Regra", null, "Concluída", "20/10/2026 09:00", "19/10/2026 09:00", "No prazo"],
    ]);
    expect(document.summary).toEqual(expect.arrayContaining([
      { label: "Atrasadas em aberto (esquecidas)", value: 1 },
      { label: "Pontualidade", value: "Sem dados" },
    ]));
  });

  it("exports team performance with formatted percentages and averages", async () => {
    const repository = makeRepository({ teamPerformance: jest.fn(async () => [teamAggregate(), teamAggregate({ teamId: "team-2", completedOnTime: 0, completedLate: 0, ruleAssignedCount: 0, ruleAssignmentSeconds: 0 })]) });
    const { service, csvRender, record } = makeService(repository);

    const file = await service.exportReport({ kind: "teams-performance", filter: period }, "csv", "actor-1");

    expect(file.filename).toBe("relatorio-desempenho-equipes_2026-10-01_2026-10-31.csv");
    const document = csvRender.mock.calls[0][0];
    expect(document.columns).toEqual([
      "Equipe", "Especialidade", "Tarefas", "Concluídas", "No prazo", "Com atraso", "Atrasadas em aberto", "Canceladas", "Pontualidade", "Atribuição média (regra)", "Atribuição média (manual)",
    ]);
    expect(document.rows[0]).toEqual(["Cozinha A", "Cozinha", 10, 6, 3, 1, 2, 1, "75%", "60 min", "0 min"]);
    expect(document.rows[1].slice(8)).toEqual(["Sem dados", "Sem dados", "0 min"]);
    expect(document.summary).toEqual(expect.arrayContaining([{ label: "Pontualidade geral", value: "75%" }]));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ changes: expect.objectContaining({ kind: "teams-performance", rows: 2 }) }));
  });
});
