import { ZodError } from 'zod';
import { describe, expect, it, jest } from '@jest/globals';

import { UserController } from './UserController.js';

describe('UserController', () => {
  it('lists users with query filters', async () => {
    const service = {
      list: jest.fn(async () => [{ id: 'u1', name: 'Alice', email: 'alice@buffet.com', isActive: true, deletedAt: null, roles: [] }]),
      get: jest.fn(async () => ({ id: 'u1', name: 'Alice', email: 'alice@buffet.com', isActive: true, deletedAt: null, roles: [] })),
      create: jest.fn(async () => ({ id: 'u1', name: 'Alice', email: 'alice@buffet.com', isActive: true, deletedAt: null, roles: [] })),
      update: jest.fn(async () => ({ id: 'u1', name: 'Alice', email: 'alice@buffet.com', isActive: true, deletedAt: null, roles: [] })),
      setActive: jest.fn(async () => ({ id: 'u1', name: 'Alice', email: 'alice@buffet.com', isActive: true, deletedAt: null, roles: [] })),
      remove: jest.fn(async () => undefined),
    };
    const response: any = { json: jest.fn() };
    const controller = new UserController(service as any);

    await controller.list({ query: { status: 'active', search: 'ali', role: 'admin' } } as any, response);

    expect(service.list).toHaveBeenCalledWith({ search: 'ali', role: 'admin', status: 'active' });
    expect(response.json).toHaveBeenCalledWith(expect.any(Array));
  });

  it('creates a user only when actor is authenticated', async () => {
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const controller = new UserController({ create: jest.fn(), list: jest.fn(), get: jest.fn(), update: jest.fn(), setActive: jest.fn(), remove: jest.fn() } as any);

    await controller.create({ user: undefined, body: { name: 'Alice', email: 'alice@buffet.com', password: 'secret123', roleId: '11111111-1111-1111-1111-111111111111' } } as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: 'Não autenticado' });
  });

  it('updates and toggles the active state', async () => {
    const service = {
      list: jest.fn(async () => []),
      get: jest.fn(async () => ({ id: 'u1', name: 'Alice', email: 'alice@buffet.com', isActive: true, deletedAt: null, roles: [] })),
      create: jest.fn(async () => ({ id: 'u1', name: 'Alice', email: 'alice@buffet.com', isActive: true, deletedAt: null, roles: [] })),
      update: jest.fn(async () => ({ id: 'u1', name: 'Alice', email: 'alice@buffet.com', isActive: true, deletedAt: null, roles: [] })),
      setActive: jest.fn(async () => ({ id: 'u1', name: 'Alice', email: 'alice@buffet.com', isActive: false, deletedAt: null, roles: [] })),
      remove: jest.fn(async () => undefined),
    };
    const json = jest.fn();
    const controller = new UserController(service as any);

    await controller.update({ user: { sub: 'actor-1' }, params: { id: 'u1' }, body: { name: 'Alice' } } as any, { json } as any);
    await controller.setActive(true)({ user: { sub: 'actor-1' }, params: { id: 'u1' } } as any, { json } as any);

    expect(service.update).toHaveBeenCalledWith('u1', { name: 'Alice' }, 'actor-1');
    expect(service.setActive).toHaveBeenCalledWith('u1', true, 'actor-1');
  });

  it('uses empty filters when query values are absent or invalid', async () => {
    const service = { list: jest.fn(async () => []), get: jest.fn(), create: jest.fn(), update: jest.fn(), setActive: jest.fn(), remove: jest.fn() };
    const controller = new UserController(service as any);

    await controller.list({ query: { status: 'unknown', search: '', role: '' } } as any, { json: jest.fn() } as any);

    expect(service.list).toHaveBeenCalledWith({ search: undefined, role: undefined, status: undefined });
  });

  it('gets, creates, deactivates, and removes an authenticated user', async () => {
    const user = { id: 'u1', name: 'Alice', email: 'alice@buffet.com', isActive: true, deletedAt: null, roles: [] };
    const service = {
      list: jest.fn(async () => []),
      get: jest.fn(async () => user),
      create: jest.fn(async () => user),
      update: jest.fn(async () => user),
      setActive: jest.fn(async () => ({ ...user, isActive: false })),
      remove: jest.fn(async () => undefined),
    };
    const json = jest.fn();
    const status = jest.fn().mockReturnThis();
    const send = jest.fn();
    const controller = new UserController(service as any);
    const request = { user: { sub: 'actor-1' }, params: { id: 'u1' }, body: { name: 'Alice', email: 'alice@buffet.com', password: 'secret123', roleId: '11111111-1111-4111-8111-111111111111' } };

    await controller.get(request as any, { json } as any);
    await controller.create(request as any, { status, json } as any);
    await controller.setActive(false)(request as any, { json } as any);
    await controller.remove(request as any, { status, send } as any);

    expect(service.get).toHaveBeenCalledWith('u1');
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ roleId: '11111111-1111-4111-8111-111111111111' }), 'actor-1');
    expect(service.setActive).toHaveBeenCalledWith('u1', false, 'actor-1');
    expect(service.remove).toHaveBeenCalledWith('u1', 'actor-1');
    expect(status).toHaveBeenCalledWith(201);
    expect(status).toHaveBeenCalledWith(204);
    expect(send).toHaveBeenCalled();
  });

  // ADR 0012: quem tem users:update (gestor, colaborador) não pode trocar a senha de outra conta pela edição.
  it('rejects a password in the update body before reaching the service', async () => {
    const service = { update: jest.fn() };
    const controller = new UserController(service as any);
    const request = { user: { sub: 'actor-1' }, params: { id: 'u1' }, body: { name: 'Alice', password: 'Invadida123!' } };

    await expect(controller.update(request as any, { json: jest.fn() } as any)).rejects.toBeInstanceOf(ZodError);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('updates name and email', async () => {
    const service = { update: jest.fn(async () => ({ id: 'u1' })) };
    const json = jest.fn();
    const controller = new UserController(service as any);

    await controller.update({ user: { sub: 'actor-1' }, params: { id: 'u1' }, body: { name: 'Alice', email: 'alice@buffet.com' } } as any, { json } as any);

    expect(service.update).toHaveBeenCalledWith('u1', { name: 'Alice', email: 'alice@buffet.com' }, 'actor-1');
    expect(json).toHaveBeenCalledWith({ id: 'u1' });
  });

  it('rejects update, activation, and removal without an authenticated actor', async () => {
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const controller = new UserController({ list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), setActive: jest.fn(), remove: jest.fn() } as any);
    const request = { user: undefined, params: { id: 'u1' }, body: { name: 'Alice' } };

    await controller.update(request as any, response);
    await controller.setActive(false)(request as any, response);
    await controller.remove(request as any, response);

    expect(response.status).toHaveBeenCalledTimes(3);
    expect(response.status).toHaveBeenCalledWith(401);
  });
});
