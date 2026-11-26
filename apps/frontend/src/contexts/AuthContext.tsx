import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/authApi'
import { clearAccessToken, refreshSession, setAccessToken } from '../api/httpClient'
import type { AuthUser, Session } from '../types'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  /** True while the page load tries to resume the session from the refresh token cookie (ADR 0020). */
  restoring: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(true)

  // Ao abrir ou recarregar a página, a memória está vazia: o cookie é o que permite continuar logado.
  // Sem cookie válido o refresh falha e a pessoa segue anônima para o login.
  useEffect(() => {
    let active = true
    // No StrictMode o efeito roda duas vezes; refreshSession compartilha a mesma requisição
    // e só a execução que continua ativa inicia a sessão.
    refreshSession()
      .then(async (session) => {
        if (!active) return
        setAccessToken(session.accessToken)
        const profile = await authApi.me()
        if (active) setUser(profile)
      })
      .catch(() => { if (active) clearAccessToken() })
      .finally(() => { if (active) setRestoring(false) })
    return () => { active = false }
  }, [])

  // Ações estáveis (só usam setters e a API) e valor memoizado: os consumidores do contexto não
  // re-renderizam a cada render do provider, só quando user, loading ou restoring mudam (KAN-88).
  const actions = useMemo(() => {
    // O refresh token fica no cookie httpOnly gravado pelo backend; aqui só o access token, em memória.
    const startSession = async (session: Session) => {
      setAccessToken(session.accessToken)
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

    // O backend revoga o refresh token do cookie e apaga o cookie; sem isso, um F5 restauraria a sessão.
    const logout = async () => {
      try { await authApi.logout() } finally { clearAccessToken(); setUser(null) }
    }

    return { login, logout, changePassword }
  }, [])
  const value = useMemo(() => ({ user, loading, restoring, ...actions }), [user, loading, restoring, actions])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }
