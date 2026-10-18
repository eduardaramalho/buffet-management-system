import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './AppRoutes'

const { authState } = vi.hoisted(() => ({ authState: { user: { id: '1', name: 'Alice', email: 'alice@example.com', roles: [{ name: 'admin', permissions: ['users:list', 'roles:list'] }] }, logout: vi.fn() } }))

vi.mock('../contexts/useAuth', () => ({ useAuth: () => authState }))
vi.mock('../pages/UsersListPage', () => ({ UsersListPage: () => <h1>Página de Usuários</h1> }))
vi.mock('../pages/RolesListPage', () => ({ RolesListPage: () => <h1>Página de Papéis</h1> }))
vi.mock('../pages/UserFormPage', () => ({ UserFormPage: () => <h1>Formulário de Usuário</h1> }))
vi.mock('../pages/RoleFormPage', () => ({ RoleFormPage: () => <h1>Formulário de Papel</h1> }))
vi.mock('../pages/LoginPage', () => ({ LoginPage: () => <h1>Login</h1> }))
vi.mock('../pages/ForgotPasswordPage', () => ({ ForgotPasswordPage: () => <h1>Esqueci a senha</h1> }))
vi.mock('../pages/ResetPasswordPage', () => ({ ResetPasswordPage: () => <h1>Redefinir senha</h1> }))

describe('AppRoutes navigation and permissions', () => {
  it('navigates from the menu to users and roles with React Router links', async () => {
    render(<MemoryRouter initialEntries={['/users']}><AppRoutes /></MemoryRouter>)

    await userEvent.click(screen.getByRole('link', { name: 'Papéis e permissões' }))
    expect(await screen.findByRole('heading', { name: 'Página de Papéis' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Usuários' }))
    expect(await screen.findByRole('heading', { name: 'Página de Usuários' })).toBeInTheDocument()
  })

  it('hides menu entries and redirects direct access when permissions are missing', async () => {
    authState.user = { ...authState.user, roles: [{ name: 'operador', permissions: ['users:list'] }] }
    render(<MemoryRouter initialEntries={['/roles']}><AppRoutes /></MemoryRouter>)

    expect(screen.queryByRole('link', { name: 'Papéis e permissões' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Página de Usuários' })).toBeInTheDocument()
  })
})
