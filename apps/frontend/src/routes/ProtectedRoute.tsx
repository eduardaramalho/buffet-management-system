import { Navigate, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/useAuth'

export function ProtectedRoute({ permission, children }: { permission?: string; children?: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (permission && !user.roles?.some((role) => role.permissions.includes(permission))) return <Navigate to="/users" replace />
  return children ?? <Outlet />
}