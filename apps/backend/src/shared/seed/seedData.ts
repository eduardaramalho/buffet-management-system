export const ADMIN_ROLE_NAME = "admin";
export const ADMIN_NAME = "Administrador";
export const ADMIN_EMAIL = "admin@buffet.local";
/** Same minimum enforced by the user and auth endpoints. */
export const ADMIN_PASSWORD_MIN_LENGTH = 8;

// RF06 / ADR 0001: the generic "Outro" entry (free label) is part of the catalog from the start.
export const GENERIC_SERVICE_NAME = "Outro";

const clientPermissions = ["clients:list", "clients:read", "clients:create", "clients:update", "clients:delete"];

const adminPermissions = ["users:list", "users:read", "users:create", "users:update", "users:delete", "users:reset-password", "roles:list", "roles:read", "roles:create", "roles:update", "roles:delete", "roles:manage-permissions", "audit:read", "dashboard:view", "events:list", "events:read", "events:create", "events:update", "events:delete", "events:restore", "events:replicate", "services:list", "services:read", "services:create", "services:update", "services:delete", "teams:list", "teams:read", "teams:create", "teams:update", "teams:delete", "teams:manage-members", "teams:assign-event", "collaborators:manage", "rules:list", "rules:read", "rules:create", "rules:update", "rules:delete", "rules:evaluate", "rules:apply", "tasks:list", "tasks:read", "tasks:update-status", "tasks:create", "tasks:update", "tasks:delete", "tasks:comment", "reports:view", ...clientPermissions];

/** Gestão de papéis: a única parte do sistema que fica só com o admin (ADR 0018). */
export const ROLE_MANAGEMENT_PERMISSIONS = ["roles:create", "roles:update", "roles:delete", "roles:manage-permissions"];

export const ROLE_PERMISSION_MATRIX: Record<string, string[]> = {
  [ADMIN_ROLE_NAME]: adminPermissions,
  // Opera o sistema inteiro, como a RFC descreve (Dashboard do Gestor, ajustes manuais, relatórios). ADR 0018.
  // Derivado do admin para uma permissão nova do admin chegar também ao gestor.
  gestor: adminPermissions.filter((key) => !ROLE_MANAGEMENT_PERMISSIONS.includes(key)),
  // Perfil operacional (quem executa as tarefas): acompanha eventos e tarefas, move o status e comenta (ADR 0017).
  // Sem users:read: GET /auth/me não exige permissão, e o colaborador não lê outros usuários (ADR 0013).
  colaborador: ["events:list", "events:read", "tasks:list", "tasks:read", "tasks:update-status", "tasks:comment"]
};
