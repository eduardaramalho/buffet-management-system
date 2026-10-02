import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { LoginPage } from '../pages/LoginPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { RoleFormPage } from '../pages/RoleFormPage'
import { RolesListPage } from '../pages/RolesListPage'
import { UserFormPage } from '../pages/UserFormPage'
import { UsersListPage } from '../pages/UsersListPage'
import { EventsListPage } from '../pages/EventsListPage'
import { TeamsListPage } from '../pages/TeamsListPage'
import { CollaboratorsListPage } from '../pages/CollaboratorsListPage'
import { RulesListPage } from '../pages/RulesListPage'
import { TasksBoardPage } from '../pages/TasksBoardPage'
import { ProtectedRoute } from './ProtectedRoute'
import { InternalLayout } from '../components/InternalLayout'

export function AppRoutes() {
	const { user, logout } = useAuth()
	const withNavigation = (page: ReactNode) => <InternalLayout onLogout={logout}>{page}</InternalLayout>

	return <Routes>
		<Route path="/login" element={user ? <Navigate to="/users" replace /> : <LoginPage />} />
		<Route path="/forgot-password" element={<ForgotPasswordPage />} />
		<Route path="/reset-password" element={<ResetPasswordPage />} />
		<Route element={<ProtectedRoute />}>
			<Route path="/users" element={<ProtectedRoute permission="users:list">{withNavigation(<UsersListPage />)}</ProtectedRoute>} />
			<Route path="/users/new" element={<ProtectedRoute permission="users:create">{withNavigation(<UserFormPage />)}</ProtectedRoute>} />
			<Route path="/users/:id/edit" element={<ProtectedRoute permission="users:update">{withNavigation(<UserFormPage />)}</ProtectedRoute>} />
			<Route path="/events" element={<ProtectedRoute permission="events:list">{withNavigation(<EventsListPage />)}</ProtectedRoute>} />
			<Route path="/teams" element={<ProtectedRoute permission="teams:list">{withNavigation(<TeamsListPage />)}</ProtectedRoute>} />
			<Route path="/collaborators" element={<ProtectedRoute permission="collaborators:manage">{withNavigation(<CollaboratorsListPage />)}</ProtectedRoute>} />
			<Route path="/rules" element={<ProtectedRoute permission="rules:list">{withNavigation(<RulesListPage />)}</ProtectedRoute>} />
			<Route path="/tasks" element={<ProtectedRoute permission="tasks:list">{withNavigation(<TasksBoardPage />)}</ProtectedRoute>} />
			<Route path="/roles" element={<ProtectedRoute permission="roles:list">{withNavigation(<RolesListPage />)}</ProtectedRoute>} />
			<Route path="/roles/new" element={<ProtectedRoute permission="roles:create">{withNavigation(<RoleFormPage />)}</ProtectedRoute>} />
			<Route path="/roles/:id" element={<ProtectedRoute permission="roles:update">{withNavigation(<RoleFormPage />)}</ProtectedRoute>} />
		</Route>
		<Route path="*" element={<Navigate to={user ? '/users' : '/login'} replace />} />
	</Routes>
}

