import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ServicesListPage } from './ServicesListPage'
import { listServices, removeService } from '../api/servicesApi'
import type { Service } from '../types/event'

vi.mock('../api/servicesApi', () => ({ listServices: vi.fn(), removeService: vi.fn(), createService: vi.fn(), updateService: vi.fn() }))
const ALL_PERMISSIONS = ['services:list', 'services:create', 'services:update', 'services:delete']
const { authState } = vi.hoisted(() => ({ authState: { permissions: [] as string[] } }))
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { roles: [{ permissions: authState.permissions }] } }) }))

const service = (id: string, name: string, isCustom = false): Service => ({ id, name, isCustom, createdAt: '', deletedAt: null })
const catalog = [service('service-bar', 'Bar'), service('service-buffet', 'Buffet completo'), service('service-outro', 'Outro', true)]

describe('ServicesListPage (RF06)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.permissions = ALL_PERMISSIONS
    vi.mocked(listServices).mockResolvedValue(catalog)
  })

  it('lists the catalog, marks the generic service and summarizes it', async () => {
    render(<ServicesListPage />)

    expect(await screen.findByText('Bar')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Serviços' })).toBeInTheDocument()
    expect(screen.getByText('Rótulo livre')).toBeInTheDocument()
    expect(screen.getByText('Total de serviços').previousSibling).toHaveTextContent('3')
  })

  it('filters by name without calling the API again, ignoring case and accents', async () => {
    render(<ServicesListPage />)
    await screen.findByText('Bar')

    fireEvent.change(screen.getByPlaceholderText('Buscar serviço...'), { target: { value: 'BUFFÊT' } })

    expect(screen.getByText('Buffet completo')).toBeInTheDocument()
    expect(screen.queryByText('Bar')).not.toBeInTheDocument()
    expect(listServices).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByPlaceholderText('Buscar serviço...'), { target: { value: 'nada' } })
    expect(screen.getByText('Nenhum serviço encontrado.')).toBeInTheDocument()
  })

  it('opens the drawer to create a service', async () => {
    render(<ServicesListPage />)
    await screen.findByText('Bar')

    fireEvent.click(screen.getByRole('button', { name: 'Novo serviço' }))

    expect(screen.getByRole('dialog', { name: 'Novo serviço' })).toBeInTheDocument()
  })

  it('opens the drawer to edit a service', async () => {
    render(<ServicesListPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Bar' }))

    expect(screen.getByRole('dialog', { name: 'Editar serviço' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome do serviço')).toHaveValue('Bar')
  })

  it('deletes after a confirmation that explains the effect on events', async () => {
    vi.mocked(removeService).mockResolvedValue(undefined)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ServicesListPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Bar' }))

    expect(confirm).toHaveBeenCalledWith('Excluir o serviço Bar? Eventos que já o contrataram continuam com ele no histórico, mas novos eventos não poderão contratá-lo.')
    await waitFor(() => expect(removeService).toHaveBeenCalledWith('service-bar'))
    await waitFor(() => expect(screen.queryByText('Bar')).not.toBeInTheDocument())
  })

  it('keeps the service when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ServicesListPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Bar' }))

    expect(removeService).not.toHaveBeenCalled()
  })

  it('never offers removal of the generic service', async () => {
    render(<ServicesListPage />)
    await screen.findByText('Bar')

    expect(screen.queryByRole('button', { name: 'Excluir Outro' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar Outro' })).toBeInTheDocument()
  })

  it('shows API errors when loading and removing', async () => {
    vi.mocked(listServices).mockRejectedValueOnce(new Error('Falha ao carregar'))
    const { unmount } = render(<ServicesListPage />)
    expect(await screen.findByText('Falha ao carregar')).toBeInTheDocument()
    unmount()

    vi.mocked(removeService).mockRejectedValueOnce(new Error('Serviço não encontrado'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ServicesListPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Bar' }))
    expect(await screen.findByText('Serviço não encontrado')).toBeInTheDocument()
    expect(screen.getByText('Bar')).toBeInTheDocument()
  })

  it('hides create, edit and delete without the matching permissions', async () => {
    authState.permissions = ['services:list']
    render(<ServicesListPage />)
    await screen.findByText('Bar')

    expect(screen.queryByRole('button', { name: 'Novo serviço' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar Bar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir Bar' })).not.toBeInTheDocument()
  })
})
