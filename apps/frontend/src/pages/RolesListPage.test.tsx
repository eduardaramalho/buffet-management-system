import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RolesListPage } from './RolesListPage'

const { listRoles, createRole, updateRole, authState } = vi.hoisted(() => ({
  listRoles: vi.fn(), createRole: vi.fn(), updateRole: vi.fn(),
  authState: { permissions: ['roles:list', 'roles:create', 'roles:update'] },
}))
vi.mock('../api/rolesApi', () => ({ listRoles, createRole, updateRole }))
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { roles: [{ permissions: authState.permissions }] } }) }))

const gestor = { id: 'r1', name: 'Gestor', description: 'Gerencia eventos', isProtected: false }

describe('RolesListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.permissions = ['roles:list', 'roles:create', 'roles:update']
    listRoles.mockResolvedValue([gestor, { id: 'r2', name: 'Operador', description: null, isProtected: false }])
  })

  it('lists the roles with the edit action', async () => {
    render(<RolesListPage />)

    expect(await screen.findByText('Gestor')).toBeInTheDocument()
    expect(screen.getByText('Gerencia eventos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar Operador' })).toBeInTheDocument()
  })

  it('creates a role in the modal, validating the name like the API', async () => {
    createRole.mockResolvedValue({ id: 'r3', name: 'Supervisor', description: '', isProtected: false })
    render(<RolesListPage />)
    await screen.findByText('Gestor')

    fireEvent.click(screen.getByRole('button', { name: 'Novo papel' }))
    const name = screen.getByLabelText('Nome')
    fireEvent.change(name, { target: { value: 'S' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar papel' }))
    expect(await screen.findByText('Use pelo menos 2 caracteres.')).toBeInTheDocument()

    fireEvent.change(name, { target: { value: 'Supervisor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar papel' }))

    await waitFor(() => expect(createRole).toHaveBeenCalledWith({ name: 'Supervisor', description: '' }))
    expect(await screen.findByText('Supervisor')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('edits a role and replaces it in the list', async () => {
    updateRole.mockResolvedValue({ ...gestor, description: 'Coordena a operação' })
    render(<RolesListPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Gestor' }))
    expect(screen.getByRole('dialog', { name: 'Editar papel' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Coordena a operação' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar papel' }))

    expect(await screen.findByRole('cell', { name: 'Coordena a operação' })).toBeInTheDocument()
    expect(updateRole).toHaveBeenCalledWith('r1', { name: 'Gestor', description: 'Coordena a operação' })
  })

  it('shows the API error inside the modal', async () => {
    createRole.mockRejectedValue(new Error('Papel já existe'))
    render(<RolesListPage />)
    await screen.findByText('Gestor')
    fireEvent.click(screen.getByRole('button', { name: 'Novo papel' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Gestor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar papel' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Papel já existe')
  })

  it('hides the actions without permission and reports a loading failure', async () => {
    authState.permissions = ['roles:list']
    listRoles.mockRejectedValue(new Error('Sem conexão'))
    render(<RolesListPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão')
    expect(screen.queryByRole('button', { name: 'Novo papel' })).not.toBeInTheDocument()
  })
})
