import { beforeEach, describe, expect, it } from "@jest/globals";
import type { PasswordHasher } from "../../modules/auth/domain/auth.types.js";
import { DatabaseSeeder } from "./DatabaseSeeder.js";
import { ADMIN_EMAIL, ADMIN_ROLE_NAME, GENERIC_SERVICE_NAME, ROLE_PERMISSION_MATRIX } from "./seedData.js";
import type { NewSeedUser, SeedRepository } from "./seed.types.js";

class InMemorySeedRepository implements SeedRepository {
  roles = new Map<string, { id: string; isProtected: boolean }>();
  permissions = new Map<string, string>();
  rolePermissions = new Set<string>();
  genericServices: string[] = [];
  users = new Map<string, NewSeedUser & { id: string }>();
  userRoles = new Set<string>();

  async upsertRole(name: string, isProtected: boolean) {
    const id = this.roles.get(name)?.id ?? `role-${name}`;
    this.roles.set(name, { id, isProtected });
    return id;
  }

  async upsertPermission(key: string) {
    const id = this.permissions.get(key) ?? `permission-${key}`;
    this.permissions.set(key, id);
    return id;
  }

  async linkRolePermission(roleId: string, permissionId: string) {
    this.rolePermissions.add(`${roleId}:${permissionId}`);
  }

  async hasActiveGenericService() {
    return this.genericServices.length > 0;
  }

  async createGenericService(name: string) {
    this.genericServices.push(name);
  }

  async findUserIdByEmail(email: string) {
    return this.users.get(email)?.id ?? null;
  }

  async createUser(user: NewSeedUser) {
    const id = `user-${this.users.size + 1}`;
    this.users.set(user.email, { ...user, id });
    return id;
  }

  async linkUserRole(userId: string, roleId: string) {
    this.userRoles.add(`${userId}:${roleId}`);
  }
}

const hasher: PasswordHasher = {
  hash: async (value) => `hashed:${value}`,
  compare: async (value, hashedValue) => hashedValue === `hashed:${value}`
};

describe("DatabaseSeeder", () => {
  let repository: InMemorySeedRepository;
  let seeder: DatabaseSeeder;

  beforeEach(() => {
    repository = new InMemorySeedRepository();
    seeder = new DatabaseSeeder(repository, hasher);
  });

  it("creates every role with its permissions and protects only the admin role", async () => {
    await seeder.run({ adminInitialPassword: "Strong-pass-1" });

    for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSION_MATRIX)) {
      const role = repository.roles.get(roleName);
      expect(role?.isProtected).toBe(roleName === ADMIN_ROLE_NAME);
      for (const key of permissionKeys) {
        expect(repository.rolePermissions.has(`${role?.id}:${repository.permissions.get(key)}`)).toBe(true);
      }
    }
  });

  it("creates the generic service only when the active catalog has none", async () => {
    await seeder.run({ adminInitialPassword: "Strong-pass-1" });
    await seeder.run({ adminInitialPassword: "Strong-pass-1" });

    expect(repository.genericServices).toEqual([GENERIC_SERVICE_NAME]);
  });

  it("creates the admin with the hashed initial password and the admin role", async () => {
    const result = await seeder.run({ adminInitialPassword: "Strong-pass-1" });

    const admin = repository.users.get(ADMIN_EMAIL);
    expect(result).toEqual({ adminCreated: true });
    expect(admin?.passwordHash).toBe("hashed:Strong-pass-1");
    expect(repository.userRoles.has(`${admin?.id}:${repository.roles.get(ADMIN_ROLE_NAME)?.id}`)).toBe(true);
  });

  it("never overwrites the password of an existing admin", async () => {
    await seeder.run({ adminInitialPassword: "Strong-pass-1" });

    const result = await seeder.run({ adminInitialPassword: "Another-pass-2" });

    expect(result).toEqual({ adminCreated: false });
    expect(repository.users.get(ADMIN_EMAIL)?.passwordHash).toBe("hashed:Strong-pass-1");
  });

  it("does not require the initial password once the admin exists", async () => {
    await seeder.run({ adminInitialPassword: "Strong-pass-1" });

    await expect(seeder.run({ adminInitialPassword: undefined })).resolves.toEqual({ adminCreated: false });
  });

  it.each([undefined, "", "short"])("refuses to create the admin with initial password %p", async (password) => {
    await expect(seeder.run({ adminInitialPassword: password })).rejects.toThrow(
      "ADMIN_INITIAL_PASSWORD precisa ter pelo menos 8 caracteres para criar o administrador"
    );
    expect(repository.users.size).toBe(0);
  });
});
