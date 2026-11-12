import { eventStatusLabels, taskStatusLabels } from "../modules/reports/domain/report.labels.js";

export type AuditChanges = {
  name?: string;
  title?: string;
  after?: string | { name?: string; title?: string; status?: string };
  customLabel?: string | null;
  eventName?: string;
  sourceEventName?: string;
  replicaEventName?: string;
} | null;

/**
 * Converte o JSON persistido em audit_logs.changes (Prisma.JsonValue) para o formato lido
 * pelas mensagens de atividade. Qualquer valor que nao seja um objeto simples vira null.
 */
export function toAuditChanges(value: unknown): AuditChanges {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AuditChanges;
}

export type AuditActivityInput = {
  action: string;
  entity: string;
  changes: AuditChanges;
  subject?: string;
};

const SERVICE_ACTION_VERBS: Record<string, string> = {
  SERVICE_CREATED: "cadastrado",
  SERVICE_UPDATED: "atualizado",
  SERVICE_DELETED: "excluído",
};

const CLIENT_ACTION_VERBS: Record<string, string> = {
  CLIENT_CREATED: "cadastrado",
  CLIENT_UPDATED: "atualizado",
  CLIENT_DELETED: "excluído",
};

type ActivityMessage = (subject: string, changes: AuditChanges) => string;

// Labels are looked up defensively: audit_logs.changes is free JSON, so an unknown value is dropped
// instead of being shown raw (KAN-78: the screen must never display stored enum codes).
function labelOf(labels: Record<string, string>, value: unknown) {
  return typeof value === "string" && Object.hasOwn(labels, value) ? labels[value] : undefined;
}

function eventStatusChanged(subject: string, changes: AuditChanges) {
  const status = labelOf(eventStatusLabels, typeof changes?.after === "object" ? changes.after.status : undefined);
  return status ? `Status do evento '${subject}' alterado para ${status}` : `Status do evento '${subject}' alterado`;
}

function taskStatusChanged(subject: string, changes: AuditChanges) {
  const status = labelOf(taskStatusLabels, changes?.after);
  return status ? `Tarefa '${subject}' marcada como ${status}` : `Tarefa '${subject}' atualizada`;
}

// One formatter per action instead of a nested ternary chain: adding an action is one line.
const ACTIVITY_MESSAGES: Record<string, ActivityMessage> = {
  EVENT_CREATED: (subject) => `Evento '${subject}' criado`,
  EVENT_DELETED: (subject) => `Evento '${subject}' excluído`,
  EVENT_RESTORED: (subject) => `Evento '${subject}' restaurado`,
  EVENT_UPDATED: (subject) => `Dados do evento '${subject}' atualizados`,
  EVENT_STATUS_CHANGED: eventStatusChanged,
  EVENT_SERVICE_ATTACHED: (subject, changes) => changes?.customLabel
    ? `Serviço '${changes.customLabel}' adicionado ao evento '${subject}'`
    : `Serviço adicionado ao evento '${subject}'`,
  EVENT_SERVICE_DETACHED: (subject) => `Serviço removido do evento '${subject}'`,
  TEAM_ASSIGNED_TO_EVENT: (subject) => `Equipe alocada ao evento '${subject}'`,
  TEAM_UNASSIGNED_FROM_EVENT: (subject) => `Equipe removida do evento '${subject}'`,
  TASK_STATUS_CHANGED: taskStatusChanged,
  EVENT_REPLICATED: (subject, changes) => `Evento '${subject}' criado a partir de '${changes?.sourceEventName ?? "outro evento"}'`,
  EVENT_USED_AS_TEMPLATE: (subject, changes) => `Evento '${subject}' usado como base para '${changes?.replicaEventName ?? "novo evento"}'`,
  TEAM_AUTO_ASSIGNED: (subject) => `Equipe atribuída automaticamente ao evento '${subject}'`,
  ...Object.fromEntries(Object.entries(CLIENT_ACTION_VERBS).map(([action, verb]): [string, ActivityMessage] => [action, (subject) => `Cliente '${subject}' ${verb}`])),
  ...Object.fromEntries(Object.entries(SERVICE_ACTION_VERBS).map(([action, verb]): [string, ActivityMessage] => [action, (subject) => `Serviço '${subject}' ${verb}`])),
};

const GENERIC_CHANGE_MESSAGE = "Alteração registrada";
const GENERIC_SUBJECT = "registro";

export function formatAuditActivityMessage({ action, changes, subject }: AuditActivityInput) {
  const after = typeof changes?.after === "object" ? changes.after : null;
  const resolvedSubject = subject ?? changes?.name ?? changes?.title ?? after?.name ?? after?.title ?? changes?.eventName;
  const format = Object.hasOwn(ACTIVITY_MESSAGES, action) ? ACTIVITY_MESSAGES[action] : undefined;
  if (format) return format(resolvedSubject ?? GENERIC_SUBJECT, changes);
  // Unmapped actions get a neutral sentence: the raw action/entity codes read like database commands
  // to the user (KAN-78) and stay only in audit_logs for technical auditing.
  return resolvedSubject ? `${GENERIC_CHANGE_MESSAGE} em '${resolvedSubject}'` : GENERIC_CHANGE_MESSAGE;
}