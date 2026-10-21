type AuditChanges = { name?: string; title?: string; after?: string | { name?: string; title?: string }; eventName?: string } | null;

export type AuditActivityInput = {
  action: string;
  entity: string;
  changes: AuditChanges;
  subject?: string;
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
        : `${action} em ${entity}`;
}