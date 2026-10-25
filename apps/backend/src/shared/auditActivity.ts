export type AuditChanges = {
  name?: string;
  title?: string;
  after?: string | { name?: string; title?: string };
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

// One formatter per action instead of a nested ternary chain: adding an action is one line.
const ACTIVITY_MESSAGES: Record<string, ActivityMessage> = {
  EVENT_CREATED: (subject) => `Evento '${subject}' criado`,
  EVENT_DELETED: (subject) => `Evento '${subject}' excluído`,
  EVENT_RESTORED: (subject) => `Evento '${subject}' restaurado`,
  TASK_STATUS_CHANGED: (subject, changes) => `Tarefa '${subject}' marcada como ${typeof changes?.after === "string" ? changes.after : "atualizada"}`,
  EVENT_REPLICATED: (subject, changes) => `Evento '${subject}' criado a partir de '${changes?.sourceEventName ?? "outro evento"}'`,
  EVENT_USED_AS_TEMPLATE: (subject, changes) => `Evento '${subject}' usado como base para '${changes?.replicaEventName ?? "novo evento"}'`,
  TEAM_AUTO_ASSIGNED: (subject) => `Equipe atribuída automaticamente ao evento '${subject}'`,
  ...Object.fromEntries(Object.entries(CLIENT_ACTION_VERBS).map(([action, verb]): [string, ActivityMessage] => [action, (subject) => `Cliente '${subject}' ${verb}`])),
  ...Object.fromEntries(Object.entries(SERVICE_ACTION_VERBS).map(([action, verb]): [string, ActivityMessage] => [action, (subject) => `Serviço '${subject}' ${verb}`])),
};

export function formatAuditActivityMessage({ action, entity, changes, subject }: AuditActivityInput) {
  const after = typeof changes?.after === "object" ? changes.after : null;
  const resolvedSubject = subject ?? changes?.name ?? changes?.title ?? after?.name ?? after?.title ?? changes?.eventName;
  const format = Object.hasOwn(ACTIVITY_MESSAGES, action) ? ACTIVITY_MESSAGES[action] : undefined;
  return format ? format(resolvedSubject ?? entity, changes) : `${action} em ${entity}`;
}