import { Navigate, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/useAuth'
import { getHomePath } from '../utils/homePath'

export function ProtectedRoute({ permission, children }: { permission?: string; children?: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  // ADR 0012: com senha temporária, nenhuma página interna abre antes da troca (o backend também bloqueia).
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  // Sem a permissão da página, vai para a primeira tela permitida (antes era sempre /users, o que entrava em loop).
  if (permission && !user.roles?.some((role) => role.permissions.includes(permission))) return <Navigate to={getHomePath(user)} replace />
  return children ?? <Outlet />
}