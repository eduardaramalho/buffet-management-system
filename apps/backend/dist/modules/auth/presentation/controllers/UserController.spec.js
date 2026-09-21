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
        const response = { json: jest.fn() };
        const controller = new UserController(service);
        await controller.list({ query: { status: 'active', search: 'ali', role: 'admin' } }, response);
        expect(service.list).toHaveBeenCalledWith({ search: 'ali', role: 'admin', status: 'active' });
        expect(response.json).toHaveBeenCalledWith(expect.any(Array));
    });
    it('creates a user only when actor is authenticated', async () => {
        const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const controller = new UserController({ create: jest.fn(), list: jest.fn(), get: jest.fn(), update: jest.fn(), setActive: jest.fn(), remove: jest.fn() });
        await controller.create({ user: undefined, body: { name: 'Alice', email: 'alice@buffet.com', password: 'secret123', roleId: '11111111-1111-1111-1111-111111111111' } }, response);
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
        const controller = new UserController(service);
        await controller.update({ user: { sub: 'actor-1' }, params: { id: 'u1' }, body: { name: 'Alice' } }, { json });
        await controller.setActive(true)({ user: { sub: 'actor-1' }, params: { id: 'u1' } }, { json });
        expect(service.update).toHaveBeenCalledWith('u1', { name: 'Alice' }, 'actor-1');
        expect(service.setActive).toHaveBeenCalledWith('u1', true, 'actor-1');
    });
    it('uses empty filters when query values are absent or invalid', async () => {
        const service = { list: jest.fn(async () => []), get: jest.fn(), create: jest.fn(), update: jest.fn(), setActive: jest.fn(), remove: jest.fn() };
        const controller = new UserController(service);
        await controller.list({ query: { status: 'unknown', search: '', role: '' } }, { json: jest.fn() });
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
        const controller = new UserController(service);
        const request = { user: { sub: 'actor-1' }, params: { id: 'u1' }, body: { name: 'Alice', email: 'alice@buffet.com', password: 'secret123', roleId: '11111111-1111-4111-8111-111111111111' } };
        await controller.get(request, { json });
        await controller.create(request, { status, json });
        await controller.setActive(false)(request, { json });
        await controller.remove(request, { status, send });
        expect(service.get).toHaveBeenCalledWith('u1');
        expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ roleId: '11111111-1111-4111-8111-111111111111' }), 'actor-1');
        expect(service.setActive).toHaveBeenCalledWith('u1', false, 'actor-1');
        expect(service.remove).toHaveBeenCalledWith('u1', 'actor-1');
        expect(status).toHaveBeenCalledWith(201);
        expect(status).toHaveBeenCalledWith(204);
        expect(send).toHaveBeenCalled();
    });
    it('rejects update, activation, and removal without an authenticated actor', async () => {
        const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const controller = new UserController({ list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), setActive: jest.fn(), remove: jest.fn() });
        const request = { user: undefined, params: { id: 'u1' }, body: { name: 'Alice' } };
        await controller.update(request, response);
        await controller.setActive(false)(request, response);
        await controller.remove(request, response);
        expect(response.status).toHaveBeenCalledTimes(3);
        expect(response.status).toHaveBeenCalledWith(401);
    });
});
