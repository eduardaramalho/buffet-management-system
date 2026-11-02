import { AuditService } from "../../application/AuditService.js";
import { UserPasswordService } from "../../application/UserPasswordService.js";
import { UserService } from "../../application/UserService.js";
import { BcryptHasher } from "../providers/BcryptHasher.js";
import { CryptoTemporaryPasswordGenerator } from "../providers/CryptoTemporaryPasswordGenerator.js";
import { PrismaAuditRepository } from "../repositories/PrismaAuditRepository.js";
import { PrismaUserRepository } from "../repositories/PrismaUserRepository.js";
import { prisma } from "../../../../shared/config/database.js";
import { UserController } from "../../presentation/controllers/UserController.js";
import { UserPasswordController } from "../../presentation/controllers/UserPasswordController.js";

const userRepository = new PrismaUserRepository(prisma);
const hasher = new BcryptHasher();
const auditService = new AuditService(new PrismaAuditRepository(prisma));
export const userService = new UserService(userRepository, hasher, auditService);
export const userController = new UserController(userService);
export const userPasswordService = new UserPasswordService(userRepository, hasher, new CryptoTemporaryPasswordGenerator(), auditService);
export const userPasswordController = new UserPasswordController(userPasswordService);
