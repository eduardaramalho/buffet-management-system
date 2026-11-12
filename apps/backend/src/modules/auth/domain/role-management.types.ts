export type RolePermission = {
  id: string;
  key: string;
  description: string | null;
};

export type ManagedRole = {
  id: string;
  name: string;
  description: string | null;
  /** Papel do dono (admin): não é atribuído no cadastro de usuário (ADR 0018). */
  isProtected: boolean;
  deletedAt: Date | null;
  permissions: RolePermission[];
};

export type RoleInput = {
  name: string;
  description?: string;
};

export type RoleUpdateInput = {
  name?: string;
  description?: string;
};

export interface RoleRepository {
  list(): Promise<ManagedRole[]>;
  findById(id: string): Promise<ManagedRole | null>;
  create(input: RoleInput): Promise<ManagedRole>;
  update(id: string, input: RoleUpdateInput): Promise<ManagedRole>;
  softDelete(id: string): Promise<ManagedRole>;
  listPermissions(): Promise<RolePermission[]>;
  assignPermission(roleId: string, permissionId: string): Promise<void>;
  revokePermission(roleId: string, permissionId: string): Promise<void>;
  countActiveUsers(roleId: string): Promise<number>;
}