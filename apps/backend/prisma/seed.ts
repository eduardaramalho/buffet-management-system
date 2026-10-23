import "dotenv/config";
import process from "node:process";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/client.js";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurada");

const url = new URL(databaseUrl);
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  allowPublicKeyRetrieval: true
});
const prisma = new PrismaClient({ adapter });

const clientPermissions = ["clients:list", "clients:read", "clients:create", "clients:update", "clients:delete"];

const matrix: Record<string, string[]> = {
  admin: ["users:list", "users:read", "users:create", "users:update", "users:delete", "roles:list", "roles:read", "roles:create", "roles:update", "roles:delete", "roles:manage-permissions", "audit:read", "dashboard:view", "events:list", "events:read", "events:create", "events:update", "events:delete", "events:restore", "events:replicate", "services:list", "services:read", "services:create", "services:update", "services:delete", "teams:list", "teams:read", "teams:create", "teams:update", "teams:delete", "teams:manage-members", "teams:assign-event", "collaborators:manage", "rules:list", "rules:read", "rules:create", "rules:update", "rules:delete", "rules:evaluate", "rules:apply", "tasks:list", "tasks:read", "tasks:update-status", "tasks:create", "tasks:update", "tasks:delete", "reports:view", ...clientPermissions],
  gestor: ["users:list", "users:read", "users:update", "audit:read", ...clientPermissions],
  colaborador: ["users:read", "users:update"]
};

for (const [roleName, permissionKeys] of Object.entries(matrix)) {
  const role = await prisma.role.upsert({ where: { name: roleName }, update: { isProtected: roleName === "admin" }, create: { name: roleName, isProtected: roleName === "admin" } });
  for (const key of permissionKeys) {
    const permission = await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id }
    });
  }
}

const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } });
const adminPasswordHash = await bcrypt.hash("Admin123!", 12);
const adminUser = await prisma.user.upsert({
  where: { email: "admin@buffet.local" },
  update: { name: "Administrador", passwordHash: adminPasswordHash, isActive: true, deletedAt: null },
  create: { name: "Administrador", email: "admin@buffet.local", passwordHash: adminPasswordHash }
});

await prisma.userRole.upsert({
  where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
  update: {},
  create: { userId: adminUser.id, roleId: adminRole.id }
});

await prisma.$disconnect();