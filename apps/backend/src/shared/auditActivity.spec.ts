import { describe, expect, it } from "@jest/globals";
import { formatAuditActivityMessage } from "./auditActivity.js";

describe("formatAuditActivityMessage", () => {
  it("formats the same messages used by dashboard activity", () => {
    expect(formatAuditActivityMessage({ action: "EVENT_CREATED", entity: "Event", changes: { name: "Casamento" } }))
      .toBe("Evento 'Casamento' criado");
    expect(formatAuditActivityMessage({ action: "UNKNOWN_ACTION", entity: "Event", changes: null }))
      .toBe("UNKNOWN_ACTION em Event");
  });
});