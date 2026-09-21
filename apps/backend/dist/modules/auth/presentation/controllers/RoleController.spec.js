import { describe, expect, it, jest } from '@jest/globals';
import { RoleController } from './RoleController.js';
const role = {
    id: 'role-1',
    name: 'Gestor',
    description: 'Gestão operacional',
    deletedAt: null,
    permissions: [],
};
describe('RoleController', () => {
    const service = () => ({
        list: jest.fn(async () => [role]),
        get: jest.fn(async () => role),
        create: jest.fn(async () => role),
        update: jest.fn(async () => role),
        remove: jest.fn(async () => role),
        listPermissions: jest.fn(async () => []),
        assignPermission: jest.fn(async () => undefined),
        revokePermission: jest.fn(async () => undefined),
    });
    it('lists roles and gets a role by id', async () => {
        const roleService = service();
        const controller = new RoleController(roleService);
        const json = jest.fn();
        await controller.list({}, { json });
        await controller.get({ params: { id: 'role-1' } }, { json });
        expect(roleService.list).toHaveBeenCalled();
        expect(roleService.get).toHaveBeenCalledWith('role-1');
        expect(json).toHaveBeenCalledTimes(2);
    });
    it('creates and updates a role with the authenticated actor', async () => {
        const roleService = service();
        const controller = new RoleController(roleService);
        const status = jest.fn().mockReturnThis();
        const json = jest.fn();
        const request = {
            user: { sub: 'actor-1' },
            params: { id: 'role-1' },
            body: { name: 'Gestor', description: 'Gestão operacional' },
        };
        await controller.create(request, { status, json });
        await controller.update({ ...request, body: { name: 'Gestor atualizado' } }, { json });
        expect(roleService.create).toHaveBeenCalledWith(request.body, 'actor-1');
        expect(roleService.update).toHaveBeenCalledWith('role-1', { name: 'Gestor atualizado' }, 'actor-1');
        expect(status).toHaveBeenCalledWith(201);
    });
    it('removes a role and lists, assigns, and revokes permissions', async () => {
        const roleService = service();
        const controller = new RoleController(roleService);
        const status = jest.fn().mockReturnThis();
        const json = jest.fn();
        const send = jest.fn();
        const request = { user: { sub: 'actor-1' }, params: { id: 'role-1' }, body: { permissionId: '11111111-1111-4111-8111-111111111111' } };
        await controller.remove(request, { status, send });
        await controller.listPermissions({}, { json });
        await controller.assignPermission(request, { status, json, send });
        await controller.revokePermission(request, { status, json, send });
        expect(roleService.remove).toHaveBeenCalledWith('role-1', 'actor-1');
        expect(roleService.listPermissions).toHaveBeenCalled();
        expect(roleService.assignPermission).toHaveBeenCalledWith('role-1', '11111111-1111-4111-8111-111111111111', 'actor-1');
        expect(roleService.revokePermission).toHaveBeenCalledWith('role-1', '11111111-1111-4111-8111-111111111111', 'actor-1');
        expect(status).toHaveBeenCalledWith(204);
        expect(send).toHaveBeenCalled();
    });
    it('returns 401 for sensitive operations without an actor', async () => {
        const controller = new RoleController(service());
        const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const request = { user: undefined, params: { id: 'role-1' }, body: { name: 'Gestor', permissionId: '11111111-1111-4111-8111-111111111111' } };
        await controller.create(request, response);
        await controller.update(request, response);
        await controller.remove(request, response);
        await controller.assignPermission(request, response);
        await controller.revokePermission(request, response);
        expect(response.status).toHaveBeenCalledTimes(5);
        expect(response.status).toHaveBeenCalledWith(401);
    });
});
