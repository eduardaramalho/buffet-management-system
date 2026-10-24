import { describe, expect, it } from "@jest/globals";
import { formatAuditActivityMessage, toAuditChanges } from "./auditActivity.js";

describe("formatAuditActivityMessage", () => {
  it("formats the same messages used by dashboard activity", () => {
    expect(formatAuditActivityMessage({ action: "EVENT_CREATED", entity: "Event", changes: { name: "Casamento" } }))
      .toBe("Evento 'Casamento' criado");
    expect(formatAuditActivityMessage({ action: "UNKNOWN_ACTION", entity: "Event", changes: null }))
      .toBe("UNKNOWN_ACTION em Event");
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
});
