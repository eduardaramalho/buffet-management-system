export interface NewSeedUser {
  name: string;
  email: string;
  passwordHash: string;
}

/** Persistence port used by the seed. Every write is idempotent so the seed can run on every deploy (ADR 0011). */
export interface SeedRepository {
  upsertRole(name: string, isProtected: boolean): Promise<string>;
  upsertPermission(key: string): Promise<string>;
  linkRolePermission(roleId: string, permissionId: string): Promise<void>;
  hasActiveGenericService(): Promise<boolean>;
  createGenericService(name: string): Promise<void>;
  findUserIdByEmail(email: string): Promise<string | null>;
  createUser(user: NewSeedUser): Promise<string>;
  linkUserRole(userId: string, roleId: string): Promise<void>;
}

export interface SeedOptions {
  /** Only used when the admin does not exist yet; an existing admin keeps its current password. */
  adminInitialPassword: string | undefined;
}

export interface SeedResult {
  adminCreated: boolean;
}
