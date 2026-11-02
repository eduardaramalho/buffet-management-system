export type Permission = { id: string; key: string; description?: string | null }
export type Role = { id: string; name: string; description?: string | null; isProtected: boolean; permissions?: Permission[] }
export type User = { id: string; name: string; email: string; isActive: boolean; deletedAt?: string | null; lastAccessAt?: string | null; roles: Array<{ role: { id: string; name: string; isProtected: boolean } }> }
// mustChangePassword: o usuário entrou com a senha temporária gerada pelo administrador e precisa trocá-la (ADR 0012).
export type Session = { user: { id: string; name: string; email: string; mustChangePassword: boolean }; accessToken: string; refreshToken: string }
export type TemporaryPassword = { temporaryPassword: string; expiresAt: string }

export type AuthUser = Session['user'] & { roles?: Array<{ name: string; permissions: string[] }> }
export * from './event'