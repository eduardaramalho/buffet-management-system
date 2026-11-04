import type { TaskStatus } from "./task.types.js";

/**
 * Task lifecycle (ADR 0014). A task must be started before it is concluded, may go back from
 * "Em andamento" to "Pendente" (started by mistake) and can be cancelled while open.
 * CONCLUIDA and CANCELADA are terminal, mirroring the event lifecycle (ADR 0001).
 */
export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  PENDENTE: ["EM_ANDAMENTO", "CANCELADA"],
  EM_ANDAMENTO: ["PENDENTE", "CONCLUIDA", "CANCELADA"],
  CONCLUIDA: [],
  CANCELADA: [],
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const canTransitionTaskStatus = (from: TaskStatus, to: TaskStatus) => TASK_STATUS_TRANSITIONS[from].includes(to);
