export class RoleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RoleError';
    }
}
export class RoleService {
    roles;
    audit;
    constructor(roles, audit) {
        this.roles = roles;
        this.audit = audit;
    }
    list() {
        return this.roles.list();
    }
    async get(id) {
        const role = await this.roles.findById(id);
        if (!role)
            throw new RoleError('Papel não encontrado');
        return role;
    }
    async create(input, actorId) {
        const role = await this.roles.create(input);
        await this.audit.record({ userId: actorId, action: 'ROLE_CREATED', entity: 'Role', entityId: role.id, changes: input });
        return role;
    }
    async update(id, input, actorId) {
        const role = await this.roles.update(id, input);
        await this.audit.record({ userId: actorId, action: 'ROLE_UPDATED', entity: 'Role', entityId: id, changes: input });
        return role;
    }
    async remove(id, actorId) {
        // Papéis vinculados a usuários ativos não são removidos para evitar acesso inconsistente.
        if (await this.roles.countActiveUsers(id) > 0)
            throw new RoleError('Não é possível remover um papel atribuído a usuários ativos');
        const role = await this.roles.softDelete(id);
        await this.audit.record({ userId: actorId, action: 'ROLE_DELETED', entity: 'Role', entityId: id });
        return role;
    }
    listPermissions() {
        return this.roles.listPermissions();
    }
    async assignPermission(roleId, permissionId, actorId) {
        await this.roles.assignPermission(roleId, permissionId);
        await this.audit.record({ userId: actorId, action: 'ROLE_PERMISSION_ASSIGNED', entity: 'RolePermission', entityId: roleId, changes: { permissionId } });
    }
    async revokePermission(roleId, permissionId, actorId) {
        await this.roles.revokePermission(roleId, permissionId);
        await this.audit.record({ userId: actorId, action: 'ROLE_PERMISSION_REVOKED', entity: 'RolePermission', entityId: roleId, changes: { permissionId } });
    }
}
