import { AuditService } from "../../application/AuditService.js";
import { AuthService } from "../../application/AuthService.js";
import { PrismaAuditRepository } from "../repositories/PrismaAuditRepository.js";
import { PrismaRefreshTokenRepository } from "../repositories/PrismaRefreshTokenRepository.js";
import { PrismaUserRepository } from "../repositories/PrismaUserRepository.js";
import { BcryptHasher } from "../providers/BcryptHasher.js";
import { JwtTokenProvider } from "../providers/JwtTokenProvider.js";
import { prisma } from "../../../../shared/config/database.js";
import { env } from "../../../../shared/config/env.js";
import { AuthController } from "../../presentation/controllers/AuthController.js";

export const tokenProvider = new JwtTokenProvider(env.jwtSecret, env.accessTokenTtl);
export const authService = new AuthService(
  new PrismaUserRepository(prisma),
  new PrismaRefreshTokenRepository(prisma),
  new BcryptHasher(),
  tokenProvider,
  env.refreshTokenTtlMs,
  new AuditService(new PrismaAuditRepository(prisma))
);

export const authController = new AuthController(authService);
