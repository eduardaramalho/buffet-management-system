import { describe, expect, it } from "@jest/globals";

import { normalizeServiceLabel } from "./eventServiceLabel.js";

const service = (isCustom: boolean) => ({ id: "service-1", name: isCustom ? "Outro" : "Bar", isCustom, createdAt: new Date(), deletedAt: null });

// Shared by attachService (RF07) and replication (RF25) so the "Outro" rule lives in one place.
describe("normalizeServiceLabel", () => {
  it("requires a label for the custom service and trims it", () => {
    expect(normalizeServiceLabel(service(true), "  Fotógrafo  ")).toEqual({ ok: true, customLabel: "Fotógrafo" });
    expect(normalizeServiceLabel(service(true), "   ")).toEqual({ ok: false, message: "customLabel é obrigatório para o serviço Outro" });
    expect(normalizeServiceLabel(service(true), null)).toEqual({ ok: false, message: "customLabel é obrigatório para o serviço Outro" });
  });

  it("rejects a label on a regular service and accepts it without one", () => {
    expect(normalizeServiceLabel(service(false), "Algo")).toEqual({ ok: false, message: "customLabel só pode ser usado para o serviço Outro" });
    expect(normalizeServiceLabel(service(false), undefined)).toEqual({ ok: true, customLabel: null });
    expect(normalizeServiceLabel(service(false), "  ")).toEqual({ ok: true, customLabel: null });
  });
});
