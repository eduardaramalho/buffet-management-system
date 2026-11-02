import { httpClient } from './httpClient'
import type { AuthUser, Session } from '../types'

export const login = async (email: string, password: string) => (await httpClient.post<Session>('/api/v1/auth/login', { email, password })).data
export const refresh = async (refreshToken: string) => (await httpClient.post<Session>('/api/v1/auth/refresh-token', { refreshToken })).data
export const logout = async (refreshToken: string) => { await httpClient.post('/api/v1/auth/logout', { refreshToken }) }
export const changePassword = async (currentPassword: string, newPassword: string) => (await httpClient.post<Session>('/api/v1/auth/change-password', { currentPassword, newPassword })).data
export const me = async () => (await httpClient.get<AuthUser>('/api/v1/auth/me')).data