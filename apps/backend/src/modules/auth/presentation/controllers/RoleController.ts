import type { Request, Response } from 'express';
import { z } from 'zod';
import type { RoleService } from '../../application/RoleService.js';

const createSchema = z.object({ name: z.string().min(2).max(50), description: z.string().max(255).optional() });
const updateSchema = z.object({ name: z.string().min(2).max(50).optional(), description: z.string().max(255).optional() });
const permissionSchema = z.object({ permissionId: z.string().uuid() });
const roleId = (request: Request) => String(request.params.id);

export class RoleController {
  constructor(private readonly service: RoleService) {}

  list = async (_request: Request, response: Response) => response.json(await this.service.list());

  get = async (request: Request, response: Response) => response.json(await this.service.get(roleId(request)));

  create = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: 'Não autenticado' });
    response.status(201).json(await this.service.create(createSchema.parse(request.body), actorId));
  };

  update = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: 'Não autenticado' });
    response.json(await this.service.update(roleId(request), updateSchema.parse(request.body), actorId));
  };

  remove = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: 'Não autenticado' });
    await this.service.remove(roleId(request), actorId);
    response.status(204).send();
  };

  listPermissions = async (_request: Request, response: Response) => response.json(await this.service.listPermissions());

  assignPermission = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: 'Não autenticado' });
    const { permissionId } = permissionSchema.parse(request.body);
    await this.service.assignPermission(roleId(request), permissionId, actorId);
    response.status(204).send();
  };

  revokePermission = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: 'Não autenticado' });
    const { permissionId } = permissionSchema.parse(request.body);
    await this.service.revokePermission(roleId(request), permissionId, actorId);
    response.status(204).send();
  };
}