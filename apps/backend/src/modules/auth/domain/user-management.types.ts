export type UserListFilter = {
  search?: string;
  role?: string;
  status?: "active" | "inactive";
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  deletedAt: Date | null;
  roles: Array<{ role: { id: string; name: string; isProtected: boolean } }>;
};

export interface UserManagementRepository {
  list(filter: UserListFilter): Promise<ManagedUser[]>;
  findManagedById(id: string): Promise<ManagedUser | null>;
  create(input: { name: string; email: string; passwordHash: string; roleId: string }): Promise<ManagedUser>;
  update(id: string, input: { name?: string; email?: string; passwordHash?: string }): Promise<ManagedUser>;
  setActive(id: string, isActive: boolean): Promise<ManagedUser>;
  softDelete(id: string): Promise<ManagedUser>;
}

export interface AuditRepository {
  record(input: { userId?: string; action: string; entity: string; entityId?: string; changes?: Record<string, unknown> }): Promise<void>;
}