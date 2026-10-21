import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientsListPage } from './ClientsListPage'
import { listClients, removeClient } from '../api/clientsApi'
import type { Client } from '../types/client'

vi.mock('../api/clientsApi', () => ({ listClients: vi.fn(), removeClient: vi.fn(), createClient: vi.fn(), updateClient: vi.fn() }))
const ALL_PERMISSIONS = ['clients:list', 'clients:create', 'clients:update', 'clients:delete']
const { authState } = vi.hoisted(() => ({ authState: { permissions: [] as string[] } }))
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { roles: [{ permissions: authState.permissions }] } }) }))

const clients: Client[] = [
  { id: 'client-1', type: 'PF', name: 'Ana Souza', document: '52998224725', email: 'ana@email.com', phone: '47999990000', notes: null, createdAt: '', updatedAt: '', deletedAt: null },
  { id: 'client-2', type: 'PJ', name: 'Buffet Alegria Ltda', document: '11222333000181', email: null, phone: null, notes: null, createdAt: '', updatedAt: '', deletedAt: null },
]

describe('ClientsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.permissions = ALL_PERMISSIONS
  })

  it('lists clients with type, formatted document and contact, and searches', async () => {
    vi.mocked(listClients).mockResolvedValue(clients)
    render(<ClientsListPage />)

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('529.982.247-25')).toBeInTheDocument()
    expect(screen.getByText('11.222.333/0001-81')).toBeInTheDocument()
    expect(screen.getByText('Pessoa jurídica')).toBeInTheDocument()
    expect(screen.getByText('ana@email.com')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome, documento ou e-mail...'), { target: { value: 'Ana' } })
    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith({ search: 'Ana' }))
  })

  it('opens the drawer to create a client', async () => {
    vi.mocked(listClients).mockResolvedValue([])
    render(<ClientsListPage />)

    expect(await screen.findByText('Nenhum cliente encontrado.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Novo cliente' }))

    expect(screen.getByRole('dialog', { name: 'Novo cliente' })).toBeInTheDocument()
  })

  it('deletes a client after confirmation', async () => {
    vi.mocked(listClients).mockResolvedValue(clients)
    vi.mocked(removeClient).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ClientsListPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Ana Souza' }))

    await waitFor(() => expect(removeClient).toHaveBeenCalledWith('client-1'))
    await waitFor(() => expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument())
  })

  it('shows the API message when the client has open events', async () => {
    vi.mocked(listClients).mockResolvedValue(clients)
    vi.mocked(removeClient).mockRejectedValue(new Error('O cliente possui 1 evento em aberto e não pode ser excluído'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ClientsListPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Ana Souza' }))

    expect(await screen.findByText('O cliente possui 1 evento em aberto e não pode ser excluído')).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
  })

  it('does not delete when the confirmation is cancelled', async () => {
    vi.mocked(listClients).mockResolvedValue(clients)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ClientsListPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Ana Souza' }))

    expect(removeClient).not.toHaveBeenCalled()
  })

  it('hides create, edit and delete actions without the matching permissions', async () => {
    authState.permissions = ['clients:list']
    vi.mocked(listClients).mockResolvedValue(clients)
    render(<ClientsListPage />)

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Novo cliente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar Ana Souza' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir Ana Souza' })).not.toBeInTheDocument()
  })
})
