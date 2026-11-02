import type { PasswordHasher } from "../../modules/auth/domain/auth.types.js";
import {
  ADMIN_EMAIL,
  ADMIN_NAME,
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_ROLE_NAME,
  GENERIC_SERVICE_NAME,
  ROLE_PERMISSION_MATRIX
} from "./seedData.js";
import type { SeedOptions, SeedRepository, SeedResult } from "./seed.types.js";

export class DatabaseSeeder {
  constructor(
    private readonly repository: SeedRepository,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async run(options: SeedOptions): Promise<SeedResult> {
    const roleIds = await this.seedRolesAndPermissions();
    await this.seedGenericService();
    return this.seedAdmin(roleIds.get(ADMIN_ROLE_NAME) as string, options.adminInitialPassword);
  }

  private async seedRolesAndPermissions() {
    const roleIds = new Map<string, string>();
    for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSION_MATRIX)) {
      const roleId = await this.repository.upsertRole(roleName, roleName === ADMIN_ROLE_NAME);
      roleIds.set(roleName, roleId);
      const permissionIds: string[] = [];
      for (const key of permissionKeys) {
        const permissionId = await this.repository.upsertPermission(key);
        await this.repository.linkRolePermission(roleId, permissionId);
        permissionIds.push(permissionId);
      }
      // The seed runs on every deploy: a permission removed from the matrix must also leave the role in production.
      await this.repository.revokeRolePermissionsExcept(roleId, permissionIds);
    }
    return roleIds;
  }

  private async seedGenericService() {
    if (!(await this.repository.hasActiveGenericService())) {
      await this.repository.createGenericService(GENERIC_SERVICE_NAME);
    }
  }

  // The password is only set on creation: rerunning the seed on every deploy must never reset a password changed in production.
  private async seedAdmin(adminRoleId: string, initialPassword: string | undefined): Promise<SeedResult> {
    const existingAdminId = await this.repository.findUserIdByEmail(ADMIN_EMAIL);
    const adminId = existingAdminId ?? (await this.createAdmin(initialPassword));
    await this.repository.linkUserRole(adminId, adminRoleId);
    return { adminCreated: existingAdminId === null };
  }

  private async createAdmin(initialPassword: string | undefined) {
    if (!initialPassword || initialPassword.length < ADMIN_PASSWORD_MIN_LENGTH) {
      throw new Error(`ADMIN_INITIAL_PASSWORD precisa ter pelo menos ${ADMIN_PASSWORD_MIN_LENGTH} caracteres para criar o administrador`);
    }
    const passwordHash = await this.passwordHasher.hash(initialPassword);
    return this.repository.createUser({ name: ADMIN_NAME, email: ADMIN_EMAIL, passwordHash });
  }
}
