import type { ServiceRecord } from "./event.types.js";

export type ServiceLabelResult = { ok: true; customLabel: string | null } | { ok: false; message: string };

// The generic "Outro" service needs a free-text label; regular services must not carry one.
// Returns a result instead of throwing so each application service raises its own error type.
export function normalizeServiceLabel(service: Pick<ServiceRecord, "isCustom">, customLabel: string | null | undefined): ServiceLabelResult {
  const label = customLabel?.trim() || null;
  if (service.isCustom && !label) return { ok: false, message: "customLabel é obrigatório para o serviço Outro" };
  if (!service.isCustom && label) return { ok: false, message: "customLabel só pode ser usado para o serviço Outro" };
  return { ok: true, customLabel: label };
}
