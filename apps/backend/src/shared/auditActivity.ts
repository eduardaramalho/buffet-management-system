export type AuditChanges = { name?: string; title?: string; after?: string | { name?: string; title?: string }; eventName?: string } | null;

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

const CLIENT_ACTION_VERBS: Record<string, string> = {
  CLIENT_CREATED: "cadastrado",
  CLIENT_UPDATED: "atualizado",
  CLIENT_DELETED: "excluído",
};

export function formatAuditActivityMessage({ action, entity, changes, subject }: AuditActivityInput) {
  const after = typeof changes?.after === "object" ? changes.after : null;
  const resolvedSubject = subject ?? changes?.name ?? changes?.title ?? after?.name ?? after?.title ?? changes?.eventName;
  const fallbackSubject = resolvedSubject ?? entity;

  return action === "EVENT_CREATED"
    ? `Evento '${fallbackSubject}' criado`
    : action === "TASK_STATUS_CHANGED"
      ? `Tarefa '${fallbackSubject}' marcada como ${typeof changes?.after === "string" ? changes.after : "atualizada"}`
      : action === "TEAM_AUTO_ASSIGNED"
        ? `Equipe atribuída automaticamente ao evento '${fallbackSubject}'`
        : action in CLIENT_ACTION_VERBS
          ? `Cliente '${fallbackSubject}' ${CLIENT_ACTION_VERBS[action]}`
          : `${action} em ${entity}`;
}