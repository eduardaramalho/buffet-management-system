import { AuditService } from '../../application/AuditService.js';
import { RoleService } from '../../application/RoleService.js';
import { RoleController } from '../../presentation/controllers/RoleController.js';
import { prisma } from '../../../../shared/config/database.js';
import { PrismaAuditRepository } from '../repositories/PrismaAuditRepository.js';
import { PrismaRoleRepository } from '../repositories/PrismaRoleRepository.js';
const roleRepository = new PrismaRoleRepository(prisma);
export const roleService = new RoleService(roleRepository, new AuditService(new PrismaAuditRepository(prisma)));
export const roleController = new RoleController(roleService);
