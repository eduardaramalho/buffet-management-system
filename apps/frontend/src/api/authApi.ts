import { httpClient } from './httpClient'
import type { AuthUser, Session } from '../types'

// A renovação da sessão fica em httpClient.refreshSession, que evita dois refresh em paralelo (ADR 0020).
export const login = async (email: string, password: string) => (await httpClient.post<Session>('/api/v1/auth/login', { email, password })).data
export const logout = async () => { await httpClient.post('/api/v1/auth/logout') }
export const changePassword = async (currentPassword: string, newPassword: string) => (await httpClient.post<Session>('/api/v1/auth/change-password', { currentPassword, newPassword })).data
export const me = async () => (await httpClient.get<AuthUser>('/api/v1/auth/me')).data
