export class UserManagementError extends Error {
    constructor(message) {
        super(message);
        this.name = "UserManagementError";
    }
}
export class UserService {
    users;
    hasher;
    audit;
    constructor(users, hasher, audit) {
        this.users = users;
        this.hasher = hasher;
        this.audit = audit;
    }
    list(filter) {
        return this.users.list(filter).then((users) => users.map((user) => this.toResponse(user)));
    }
    async get(id) {
        const user = await this.users.findManagedById(id);
        if (!user)
            throw new Error("Usuário não encontrado");
        return this.toResponse(user);
    }
    async create(input, actorId) {
        const user = await this.users.create({ ...input, email: input.email.toLowerCase().trim(), passwordHash: await this.hasher.hash(input.password) });
        await this.audit.record({ userId: actorId, action: "USER_CREATED", entity: "User", entityId: user.id, changes: { name: user.name, email: user.email, roleId: input.roleId } });
        return this.toResponse(user);
    }
    async update(id, input, actorId) {
        await this.ensureUserCanBeEdited(id);
        const user = await this.users.update(id, {
            name: input.name,
            email: input.email?.toLowerCase().trim(),
            passwordHash: input.password ? await this.hasher.hash(input.password) : undefined
        });
        await this.audit.record({ userId: actorId, action: "USER_UPDATED", entity: "User", entityId: id, changes: { name: input.name, email: input.email } });
        return this.toResponse(user);
    }
    async setActive(id, isActive, actorId) {
        await this.ensureUserCanBeEdited(id);
        const user = await this.users.setActive(id, isActive);
        await this.audit.record({ userId: actorId, action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", entity: "User", entityId: id, changes: { isActive } });
        return this.toResponse(user);
    }
    async remove(id, actorId) {
        await this.ensureUserCanBeEdited(id);
        const user = await this.users.softDelete(id);
        await this.audit.record({ userId: actorId, action: "USER_DELETED", entity: "User", entityId: id });
        return this.toResponse(user);
    }
    toResponse(user) {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            isActive: user.isActive,
            deletedAt: user.deletedAt,
            roles: user.roles
        };
    }
    async ensureUserCanBeEdited(id) {
        const user = await this.users.findManagedById(id);
        if (!user)
            throw new UserManagementError("Usuário não encontrado");
        const isAdministrator = user.roles.some(({ role }) => role.isProtected);
        if (isAdministrator)
            throw new UserManagementError("Usuários administradores não podem ser editados pela interface");
    }
}
