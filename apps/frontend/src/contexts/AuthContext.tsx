import { createContext, useState, type ReactNode } from 'react'
import * as authApi from '../api/authApi'
import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from '../api/httpClient'
import type { AuthUser, Session } from '../types'

type AuthContextValue = { user: AuthUser | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(false)

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const session: Session = await authApi.login(email, password)
      setAccessToken(session.accessToken)
      // ADR futura: substituir refresh token no corpo por cookie httpOnly, alinhando o contrato com o backend.
      setRefreshToken(session.refreshToken)
      setUser(await authApi.me())
    } finally { setLoading(false) }
  }

  const logout = async () => {
    const refreshToken = getRefreshToken()
    try { if (refreshToken) await authApi.logout(refreshToken) } finally { clearTokens(); setUser(null) }
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export { AuthContext }