import { httpClient } from './httpClient'
import type { AuthUser, Session } from '../types'

export const login = async (email: string, password: string) => (await httpClient.post<Session>('/api/v1/auth/login', { email, password })).data
export const refresh = async (refreshToken: string) => (await httpClient.post<Session>('/api/v1/auth/refresh-token', { refreshToken })).data
export const logout = async (refreshToken: string) => { await httpClient.post('/api/v1/auth/logout', { refreshToken }) }
export const forgotPassword = async (email: string) => { await httpClient.post('/api/v1/auth/forgot-password', { email }) }
export const resetPassword = async (token: string, password: string) => { await httpClient.post('/api/v1/auth/reset-password', { token, password }) }
export const me = async () => (await httpClient.get<AuthUser>('/api/v1/auth/me')).data