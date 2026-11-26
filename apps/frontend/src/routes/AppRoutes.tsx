import { DashboardPage } from '../pages/DashboardPage'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { ChangePasswordPage } from '../pages/ChangePasswordPage'
import { LoginPage } from '../pages/LoginPage'
import { RolesListPage } from '../pages/RolesListPage'
import { UsersListPage } from '../pages/UsersListPage'
import { EventsListPage } from '../pages/EventsListPage'
import { TeamsListPage } from '../pages/TeamsListPage'
import { CollaboratorsListPage } from '../pages/CollaboratorsListPage'
import { ClientsListPage } from '../pages/ClientsListPage'
import { ServicesListPage } from '../pages/ServicesListPage'
import { RulesListPage } from '../pages/RulesListPage'
import { TasksBoardPage } from '../pages/TasksBoardPage'
import { EventDetailsPage } from '../pages/EventDetailsPage'
import { ReportsPage } from '../pages/ReportsPage'
import { ProtectedRoute } from './ProtectedRoute'
import { InternalLayout } from '../components/InternalLayout'
import { RouteErrorBoundary } from '../components/RouteErrorBoundary'
import { Notice } from '../components/Notice'
import { LoadingIndicator } from '../components/LoadBoundary'
import { NO_ACCESS_PATH, getHomePath } from '../utils/homePath'
import { usePageTitle } from '../hooks/usePageTitle'

export function AppRoutes() {
	const { user, logout, restoring } = useAuth()
	const { pathname } = useLocation()
	// Enquanto a sessão é restaurada pelo cookie (ADR 0020), nenhuma rota decide: sem isso, um F5 em /events
	// mandaria a pessoa logada para o login antes da resposta do refresh.
	if (restoring) return <LoadingIndicator label="Carregando sessão..." />
	// O boundary fica dentro do layout: um erro numa tela preserva o menu, o botão Sair e a sessão.
	const withNavigation = (page: ReactNode) => <InternalLayout onLogout={logout}><RouteErrorBoundary resetKey={pathname}>{page}</RouteErrorBoundary></InternalLayout>

	return <Routes>
		<Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
		{/* Só para quem entrou com senha temporária; sem troca pendente, volta para o painel. */}
		<Route path="/change-password" element={!user ? <Navigate to="/login" replace /> : user.mustChangePassword ? <ChangePasswordPage /> : <Navigate to="/" replace />} />
		<Route element={<ProtectedRoute />}>
			<Route path="/" element={<ProtectedRoute permission="dashboard:view">{withNavigation(<DashboardPage />)}</ProtectedRoute>} />
			<Route path="/users" element={<ProtectedRoute permission="users:list">{withNavigation(<UsersListPage />)}</ProtectedRoute>} />
			<Route path="/events" element={<ProtectedRoute permission="events:list">{withNavigation(<EventsListPage />)}</ProtectedRoute>} />
			<Route path="/events/:id" element={<ProtectedRoute permission="events:read">{withNavigation(<EventDetailsPage />)}</ProtectedRoute>} />
			<Route path="/teams" element={<ProtectedRoute permission="teams:list">{withNavigation(<TeamsListPage />)}</ProtectedRoute>} />
			<Route path="/clients" element={<ProtectedRoute permission="clients:list">{withNavigation(<ClientsListPage />)}</ProtectedRoute>} />
			<Route path="/services" element={<ProtectedRoute permission="services:list">{withNavigation(<ServicesListPage />)}</ProtectedRoute>} />
			<Route path="/collaborators" element={<ProtectedRoute permission="collaborators:manage">{withNavigation(<CollaboratorsListPage />)}</ProtectedRoute>} />
			<Route path="/rules" element={<ProtectedRoute permission="rules:list">{withNavigation(<RulesListPage />)}</ProtectedRoute>} />
			<Route path="/tasks" element={<ProtectedRoute permission="tasks:list">{withNavigation(<TasksBoardPage />)}</ProtectedRoute>} />
			<Route path="/reports" element={<ProtectedRoute permission="reports:view">{withNavigation(<ReportsPage />)}</ProtectedRoute>} />
			<Route path="/roles" element={<ProtectedRoute permission="roles:list">{withNavigation(<RolesListPage />)}</ProtectedRoute>} />
			<Route path={NO_ACCESS_PATH} element={withNavigation(<NoAccessPage />)} />
		</Route>
		<Route path="*" element={<Navigate to={user ? getHomePath(user) : '/login'} replace />} />
	</Routes>
}

// Usuário sem nenhuma tela permitida: mantém o menu (vazio) e o botão Sair em vez de uma tela em branco.
function NoAccessPage() {
	usePageTitle('Sem acesso')
	return <main className="app-shell"><header><div><h1>Sem acesso</h1></div></header><Notice message="Seu perfil não tem acesso a nenhuma tela. Procure o administrador do sistema." /></main>
}
