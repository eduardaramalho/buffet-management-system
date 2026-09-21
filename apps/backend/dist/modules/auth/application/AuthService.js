import { createHash } from "node:crypto";
import { randomBytes } from "node:crypto";
export class AuthError extends Error {
    constructor(message = "Credenciais inválidas") {
        super(message);
        this.name = "AuthError";
    }
}
export class AuthService {
    users;
    refreshTokens;
    hasher;
    tokens;
    refreshTokenTtlMs;
    passwordResetTokens;
    emailProvider;
    passwordResetTtlMs;
    constructor(users, refreshTokens, hasher, tokens, refreshTokenTtlMs, passwordResetTokens, emailProvider, passwordResetTtlMs) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.hasher = hasher;
        this.tokens = tokens;
        this.refreshTokenTtlMs = refreshTokenTtlMs;
        this.passwordResetTokens = passwordResetTokens;
        this.emailProvider = emailProvider;
        this.passwordResetTtlMs = passwordResetTtlMs;
    }
    async login(email, password, ip) {
        const user = await this.users.findByEmail(email.toLowerCase().trim());
        if (!user || !user.isActive || user.deletedAt || !(await this.hasher.compare(password, user.passwordHash))) {
            throw new AuthError();
        }
        return this.issueTokens(user.id, user.email, user.name, ip);
    }
    async refresh(refreshToken, ip) {
        const stored = await this.refreshTokens.findByHash(this.hash(refreshToken));
        if (!stored || stored.revokedAt || stored.expiresAt <= new Date())
            throw new AuthError("Refresh token inválido");
        const user = await this.users.findById(stored.userId);
        if (!user || !user.isActive || user.deletedAt)
            throw new AuthError("Usuário indisponível");
        await this.refreshTokens.revoke(stored.id);
        return this.issueTokens(user.id, user.email, user.name, ip);
    }
    async logout(refreshToken) {
        const stored = await this.refreshTokens.findByHash(this.hash(refreshToken));
        if (stored && !stored.revokedAt)
            await this.refreshTokens.revoke(stored.id);
    }
    async forgotPassword(email) {
        const user = await this.users.findByEmail(email.toLowerCase().trim());
        if (!user || !user.isActive || user.deletedAt)
            return;
        const token = randomBytes(32).toString("base64url");
        await this.passwordResetTokens.create({ userId: user.id, tokenHash: this.hash(token), expiresAt: new Date(Date.now() + this.passwordResetTtlMs) });
        await this.emailProvider.sendPasswordReset({ to: user.email, name: user.name, token });
    }
    async resetPassword(token, password) {
        const stored = await this.passwordResetTokens.findByHash(this.hash(token));
        if (!stored || stored.usedAt || stored.expiresAt <= new Date())
            throw new AuthError("Token de recuperação inválido");
        await this.users.updatePassword(stored.userId, await this.hasher.hash(password));
        await this.passwordResetTokens.markUsed(stored.id);
    }
    async me(userId) {
        const user = await this.users.findById(userId);
        if (!user || !user.isActive || user.deletedAt)
            throw new AuthError("Usuário indisponível");
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            roles: user.roles.map(({ role }) => ({ name: role.name, permissions: role.permissions.map(({ permission }) => permission.key) }))
        };
    }
    async hasPermission(userId, permissionKey) {
        const user = await this.users.findById(userId);
        return Boolean(user?.isActive && !user.deletedAt && user.roles.some(({ role }) => role.permissions.some(({ permission }) => permission.key === permissionKey)));
    }
    async issueTokens(userId, email, name, ip) {
        const refreshToken = this.tokens.createRefreshToken();
        await this.refreshTokens.create({
            userId,
            tokenHash: this.hash(refreshToken),
            expiresAt: new Date(Date.now() + this.refreshTokenTtlMs),
            createdByIp: ip
        });
        return { user: { id: userId, name, email }, accessToken: this.tokens.createAccessToken({ sub: userId, email }), refreshToken };
    }
    hash(value) {
        return createHash("sha256").update(value).digest("hex");
    }
}
