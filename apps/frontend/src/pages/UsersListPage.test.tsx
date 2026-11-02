import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersListPage } from './UsersListPage'

const { listUsers, createUser, listRoles, setUserActive, updateUser, getUser, resetUserPassword, authState } = vi.hoisted(() => ({
  resetUserPassword: vi.fn(),
  authState: { user: { id: 'me', name: 'Admin', email: 'admin@buffet.local', roles: [{ name: 'admin', permissions: ['users:list', 'users:reset-password'] }] } as unknown },
  listUsers: vi.fn(),
  createUser: vi.fn(),
  listRoles: vi.fn(),
  setUserActive: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('../api/usersApi', () => ({ listUsers, createUser, setUserActive, updateUser, getUser, resetUserPassword }))
vi.mock('../contexts/useAuth', () => ({ useAuth: () => authState }))
vi.mock('../api/rolesApi', () => ({ listRoles }))

describe('UsersListPage creation flow', () => {
  const renderPage = () => render(<MemoryRouter><UsersListPage /></MemoryRouter>)

  beforeEach(() => {
    listUsers.mockResolvedValue([])
    listRoles.mockResolvedValue([{ id: 'role-1', name: 'Administrador', isProtected: true }])
    createUser.mockResolvedValue({ id: 'user-1', name: 'Alice', email: 'alice@example.com', isActive: true, roles: [{ role: { id: 'role-1', name: 'qualquer nome', isProtected: true } }] })
    setUserActive.mockResolvedValue(undefined)
    updateUser.mockResolvedValue(undefined)
    getUser.mockResolvedValue(undefined)
  })

  it('opens the user form when clicking New user', async () => {
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Novo usuário' })).toBeInTheDocument()
  })

  it('shows required field validation before submitting', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
    await userEvent.click(screen.getByRole('button', { name: 'Criar usuário' }))

    expect(createUser).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Nome')).toBeInvalid()
  })

  it('creates a user and refreshes the list without reloading the page', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
    await userEvent.type(screen.getByLabelText('Nome'), 'Alice')
    await userEvent.type(screen.getByLabelText('E-mail'), 'alice@example.com')
    await userEvent.selectOptions(screen.getByLabelText('Papel'), 'role-1')
    await userEvent.type(screen.getByLabelText('Senha inicial'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Criar usuário' }))

    expect(createUser).toHaveBeenCalledWith({ name: 'Alice', email: 'alice@example.com', password: 'secret123', roleId: 'role-1' })
    expect(await screen.findByText('Alice')).toBeInTheDocument()
  })

  it('shows a clear error when creation fails', async () => {
    createUser.mockRejectedValue(new Error('E-mail já cadastrado'))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
    await userEvent.type(screen.getByLabelText('Nome'), 'Alice')
    await userEvent.type(screen.getByLabelText('E-mail'), 'alice@example.com')
    await userEvent.selectOptions(screen.getByLabelText('Papel'), 'role-1')
    await userEvent.type(screen.getByLabelText('Senha inicial'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Criar usuário' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail já cadastrado')
  })

  it('shows actions for common users and opens the read-only view', async () => {
    const commonUser = { id: 'user-1', name: 'Alice', email: 'alice@example.com', isActive: true, roles: [{ role: { id: 'role-1', name: 'Operador' } }] }
    listUsers.mockResolvedValue([commonUser])
    getUser.mockResolvedValue({ ...commonUser, lastAccessAt: '2026-08-27T10:00:00.000Z' })
    renderPage()

    expect(await screen.findByRole('button', { name: 'Editar Alice' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Desativar Alice' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Visualizar Alice' }))

    expect(await screen.findByRole('dialog')).toHaveTextContent('alice@example.com')
  })

  it('disables edit and status actions for administrators', async () => {
    const admin = { id: 'admin-1', name: 'Administrador', email: 'admin@example.com', isActive: true, roles: [{ role: { id: 'role-admin', name: 'qualquer nome', isProtected: true } }] }
    listUsers.mockResolvedValue([admin])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Editar Administrador' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Desativar Administrador' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Visualizar Administrador' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('confirms deactivation and updates the row status', async () => {
    const user = { id: 'user-1', name: 'Alice', email: 'alice@example.com', isActive: true, roles: [{ role: { id: 'role-1', name: 'Operador' } }] }
    listUsers.mockResolvedValue([user])
    setUserActive.mockResolvedValue({ ...user, isActive: false })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Desativar Alice' }))
    expect(setUserActive).toHaveBeenCalledWith('user-1', false)
    expect(await screen.findByText('Inativo')).toBeInTheDocument()
  })

  it('shows an API business error when an edit request is rejected', async () => {
    const user = { id: 'user-1', name: 'Alice', email: 'alice@example.com', isActive: true, roles: [{ role: { id: 'role-1', name: 'Operador' } }] }
    listUsers.mockResolvedValue([user])
    getUser.mockResolvedValue(user)
    updateUser.mockRejectedValue(new Error('Usuários administradores não podem ser editados pela interface'))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Alice' }))
    await userEvent.clear(await screen.findByLabelText('Nome'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Novo nome')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuários administradores não podem ser editados pela interface')
  })

  it('opens the password reset for common users when the actor has the permission', async () => {
    const commonUser = { id: 'user-1', name: 'Alice', email: 'alice@example.com', isActive: true, roles: [{ role: { id: 'role-1', name: 'Operador', isProtected: false } }] }
    listUsers.mockResolvedValue([commonUser])
    resetUserPassword.mockResolvedValue({ temporaryPassword: 'Abcd2345efgh', expiresAt: '2026-10-28T15:00:00.000Z' })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Redefinir senha de Alice' }))
    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    expect(resetUserPassword).toHaveBeenCalledWith('user-1')
    expect(await screen.findByText('Abcd2345efgh')).toBeInTheDocument()
  })

  it('disables the password reset for administrators', async () => {
    const admin = { id: 'admin-1', name: 'Administrador', email: 'admin@example.com', isActive: true, roles: [{ role: { id: 'role-admin', name: 'admin', isProtected: true } }] }
    listUsers.mockResolvedValue([admin])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Redefinir senha de Administrador' })).toBeDisabled()
  })

  it('hides the password reset from actors without the permission', async () => {
    const commonUser = { id: 'user-1', name: 'Alice', email: 'alice@example.com', isActive: true, roles: [{ role: { id: 'role-1', name: 'Operador', isProtected: false } }] }
    listUsers.mockResolvedValue([commonUser])
    const previous = authState.user
    authState.user = { id: 'me', name: 'Gestor', email: 'g@buffet.com', roles: [{ name: 'gestor', permissions: ['users:list'] }] }
    renderPage()

    expect(await screen.findByRole('button', { name: 'Editar Alice' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Redefinir senha de Alice' })).not.toBeInTheDocument()
    authState.user = previous
  })
})
