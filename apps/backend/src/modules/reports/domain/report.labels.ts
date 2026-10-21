import type { EventStatus, EventType } from "../../events/domain/event.types.js";
import type { TaskStatus } from "../../tasks/domain/task.types.js";
import type { TeamSpecialty } from "../../teams/domain/team.types.js";
import type { TaskOrigin } from "./report.types.js";

// pt-BR labels used only by exported files (CSV/PDF). The JSON API keeps the enum values; the frontend
// owns the labels it renders on screen.
export const eventStatusLabels: Record<EventStatus, string> = {
  PLANEJAMENTO: "Planejamento",
  CONFIRMADO: "Confirmado",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export const eventTypeLabels: Record<EventType, string> = {
  CASAMENTO: "Casamento",
  ANIVERSARIO: "Aniversário",
  FORMATURA: "Formatura",
  CORPORATIVO: "Corporativo",
  CONFRATERNIZACAO: "Confraternização",
  BATIZADO: "Batizado",
  OUTRO: "Outro",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const teamSpecialtyLabels: Record<TeamSpecialty, string> = {
  COZINHA: "Cozinha",
  SALAO: "Salão",
  BAR: "Bar",
  DECORACAO: "Decoração",
  LIMPEZA: "Limpeza",
  CERIMONIAL: "Cerimonial",
  OUTRO: "Outro",
};

export const taskOriginLabels: Record<TaskOrigin, string> = { REGRA: "Regra", MANUAL: "Manual" };
