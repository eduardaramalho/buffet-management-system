import { createContext, useState, type ReactNode } from 'react'
import * as authApi from '../api/authApi'
import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from '../api/httpClient'
import type { AuthUser, Session } from '../types'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(false)

  const startSession = async (session: Session) => {
    setAccessToken(session.accessToken)
    // ADR futura: substituir refresh token no corpo por cookie httpOnly, alinhando o contrato com o backend.
    setRefreshToken(session.refreshToken)
    setUser(await authApi.me())
  }

  const login = async (email: string, password: string) => {
    setLoading(true)
    try { await startSession(await authApi.login(email, password)) } finally { setLoading(false) }
  }

  // O backend revoga as sessões antigas na troca e devolve um par novo de tokens, já sem a troca pendente.
  const changePassword = async (currentPassword: string, newPassword: string) => {
    setLoading(true)
    try { await startSession(await authApi.changePassword(currentPassword, newPassword)) } finally { setLoading(false) }
  }

  const logout = async () => {
    const refreshToken = getRefreshToken()
    try { if (refreshToken) await authApi.logout(refreshToken) } finally { clearTokens(); setUser(null) }
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, changePassword }}>{children}</AuthContext.Provider>
}

export { AuthContext }