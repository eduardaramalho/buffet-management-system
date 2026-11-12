import { describe, expect, it } from "@jest/globals";
import { formatAuditActivityMessage, toAuditChanges } from "./auditActivity.js";

describe("formatAuditActivityMessage", () => {
  it("formats the same messages used by dashboard activity", () => {
    expect(formatAuditActivityMessage({ action: "EVENT_CREATED", entity: "Event", changes: { name: "Casamento" } }))
      .toBe("Evento 'Casamento' criado");
  });

  it("never exposes technical codes (action or entity names) for unmapped actions", () => {
    expect(formatAuditActivityMessage({ action: "UNKNOWN_ACTION", entity: "Event", changes: null }))
      .toBe("Alteração registrada");
    expect(formatAuditActivityMessage({ action: "UNKNOWN_ACTION", entity: "Event", changes: null, subject: "Casamento" }))
      .toBe("Alteração registrada em 'Casamento'");
  });

  it("formats client activity in Portuguese", () => {
    expect(formatAuditActivityMessage({ action: "CLIENT_CREATED", entity: "Client", changes: { name: "Ana" } })).toBe("Cliente 'Ana' cadastrado");
    expect(formatAuditActivityMessage({ action: "CLIENT_UPDATED", entity: "Client", changes: { name: "Ana" } })).toBe("Cliente 'Ana' atualizado");
    expect(formatAuditActivityMessage({ action: "CLIENT_DELETED", entity: "Client", changes: { name: "Ana" } })).toBe("Cliente 'Ana' excluído");
  });
});
describe("toAuditChanges", () => {
  it("returns the object when the persisted JSON is a plain object", () => {
    const value = { name: "Casamento", after: { title: "Montar mesas" } };
    expect(toAuditChanges(value)).toEqual(value);
  });

  it.each([null, undefined, "texto", 42, true, ["a", "b"]])("returns null for non-object JSON (%p)", (value) => {
    expect(toAuditChanges(value)).toBeNull();
  });

  it("formats replication activity in Portuguese (RF25)", () => {
    expect(formatAuditActivityMessage({
      action: "EVENT_REPLICATED",
      entity: "Event",
      changes: { name: "Casamento de Bruna", sourceEventName: "Casamento de Alice" } as never,
    })).toBe("Evento 'Casamento de Bruna' criado a partir de 'Casamento de Alice'");
    expect(formatAuditActivityMessage({
      action: "EVENT_USED_AS_TEMPLATE",
      entity: "Event",
      changes: { name: "Casamento de Alice", replicaEventName: "Casamento de Bruna" } as never,
    })).toBe("Evento 'Casamento de Alice' usado como base para 'Casamento de Bruna'");
    expect(formatAuditActivityMessage({ action: "EVENT_REPLICATED", entity: "Event", changes: { name: "X" } })).toBe("Evento 'X' criado a partir de 'outro evento'");
    expect(formatAuditActivityMessage({ action: "EVENT_USED_AS_TEMPLATE", entity: "Event", changes: { name: "X" } })).toBe("Evento 'X' usado como base para 'novo evento'");
  });

  it("formats service catalog activity in Portuguese (RF06)", () => {
    expect(formatAuditActivityMessage({ action: "SERVICE_CREATED", entity: "Service", changes: { name: "Bar" } })).toBe("Serviço 'Bar' cadastrado");
    expect(formatAuditActivityMessage({ action: "SERVICE_UPDATED", entity: "Service", changes: { name: "Bar 2" } })).toBe("Serviço 'Bar 2' atualizado");
    expect(formatAuditActivityMessage({ action: "SERVICE_DELETED", entity: "Service", changes: { name: "Bar" } })).toBe("Serviço 'Bar' excluído");
  });

  it("formats event deletion and restoration (soft delete)", () => {
    expect(formatAuditActivityMessage({ action: "EVENT_DELETED", entity: "Event", changes: { after: { name: "Casamento" } } })).toBe("Evento 'Casamento' excluído");
    expect(formatAuditActivityMessage({ action: "EVENT_RESTORED", entity: "Event", changes: { name: "Casamento" } })).toBe("Evento 'Casamento' restaurado");
  });
});

describe("formatAuditActivityMessage for the event history screen", () => {
  const subject = "Casamento";

  it.each([
    ["EVENT_UPDATED", {}, "Dados do evento 'Casamento' atualizados"],
    ["EVENT_STATUS_CHANGED", { after: { status: "CONFIRMADO" } }, "Status do evento 'Casamento' alterado para Confirmado"],
    ["EVENT_STATUS_CHANGED", { after: {} }, "Status do evento 'Casamento' alterado"],
    ["EVENT_SERVICE_ATTACHED", { serviceId: "s1", customLabel: "Mesa de doces" }, "Serviço 'Mesa de doces' adicionado ao evento 'Casamento'"],
    ["EVENT_SERVICE_ATTACHED", { serviceId: "s1", customLabel: null }, "Serviço adicionado ao evento 'Casamento'"],
    ["EVENT_SERVICE_DETACHED", { serviceId: "s1" }, "Serviço removido do evento 'Casamento'"],
    ["TEAM_ASSIGNED_TO_EVENT", { teamId: "t1" }, "Equipe alocada ao evento 'Casamento'"],
    ["TEAM_UNASSIGNED_FROM_EVENT", { teamId: "t1" }, "Equipe removida do evento 'Casamento'"],
    ["TEAM_AUTO_ASSIGNED", { teamId: "t1" }, "Equipe atribuída automaticamente ao evento 'Casamento'"],
  ])("formats %s as a business message", (action, changes, expected) => {
    expect(formatAuditActivityMessage({ action, entity: "Event", changes: changes as never, subject })).toBe(expected);
  });

  it("translates the task status instead of showing the stored enum", () => {
    expect(formatAuditActivityMessage({ action: "TASK_STATUS_CHANGED", entity: "Task", changes: { after: "CONCLUIDA" }, subject: "Montar mesas" }))
      .toBe("Tarefa 'Montar mesas' marcada como Concluída");
    expect(formatAuditActivityMessage({ action: "TASK_STATUS_CHANGED", entity: "Task", changes: { after: "VALOR_DESCONHECIDO" }, subject: "Montar mesas" }))
      .toBe("Tarefa 'Montar mesas' atualizada");
  });

  it("does not leak identifiers, enum values or entity names into any mapped message", () => {
    const actions = ["EVENT_UPDATED", "EVENT_STATUS_CHANGED", "EVENT_SERVICE_ATTACHED", "EVENT_SERVICE_DETACHED", "TEAM_ASSIGNED_TO_EVENT", "TEAM_UNASSIGNED_FROM_EVENT", "UNKNOWN_ACTION"];
    const changes = { serviceId: "s1", teamId: "t1", before: { status: "PLANEJAMENTO" }, after: { status: "CONFIRMADO" } };
    for (const action of actions) {
      const message = formatAuditActivityMessage({ action, entity: "Event", changes: changes as never, subject });
      expect(message).not.toMatch(/[A-Z]{2,}_[A-Z_]+|\bEvent\b|\b(SELECT|INSERT|UPDATE|DELETE)\b|s1|t1/);
    }
  });
});
