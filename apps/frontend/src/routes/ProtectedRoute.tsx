import { Navigate, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/useAuth'

export function ProtectedRoute({ permission, children }: { permission?: string; children?: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  // ADR 0012: com senha temporária, nenhuma página interna abre antes da troca (o backend também bloqueia).
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  if (permission && !user.roles?.some((role) => role.permissions.includes(permission))) return <Navigate to="/users" replace />
  return children ?? <Outlet />
}