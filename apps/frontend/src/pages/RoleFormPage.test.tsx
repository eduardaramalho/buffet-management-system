import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoleFormPage } from './RoleFormPage'

const { createRole, getRole, updateRole } = vi.hoisted(() => ({ createRole: vi.fn(), getRole: vi.fn(), updateRole: vi.fn() }))
vi.mock('../api/rolesApi', () => ({ createRole, getRole, updateRole }))

describe('RoleFormPage', () => {
  const renderAt = (url: string) => render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/roles/new" element={<RoleFormPage />} />
        <Route path="/roles/:id" element={<RoleFormPage />} />
        <Route path="/roles" element={<p>Lista de papéis</p>} />
      </Routes>
    </MemoryRouter>,
  )

  beforeEach(() => { vi.clearAllMocks() })

  it('cria um papel e volta para a lista', async () => {
    createRole.mockResolvedValue({ id: 'r1' })
    renderAt('/roles/new')

    expect(screen.getByRole('heading', { name: 'Novo papel' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Nome'), 'Gestor')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Gerencia eventos')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(getRole).not.toHaveBeenCalled()
    expect(createRole).toHaveBeenCalledWith({ name: 'Gestor', description: 'Gerencia eventos' })
    expect(await screen.findByText('Lista de papéis')).toBeInTheDocument()
  })

  it('carrega o papel existente, atualiza e volta para a lista', async () => {
    getRole.mockResolvedValue({ id: 'r1', name: 'Gestor', description: null })
    updateRole.mockResolvedValue({ id: 'r1' })
    renderAt('/roles/r1')

    expect(screen.getByRole('heading', { name: 'Editar papel' })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Gestor')).toBeInTheDocument()
    expect(screen.getByLabelText('Descrição')).toHaveValue('')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Coordena')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(updateRole).toHaveBeenCalledWith('r1', { name: 'Gestor', description: 'Coordena' })
    expect(await screen.findByText('Lista de papéis')).toBeInTheDocument()
  })

  it('mostra erro de carregamento', async () => {
    getRole.mockRejectedValue(new Error('Papel não encontrado'))
    renderAt('/roles/r404')

    expect(await screen.findByRole('alert')).toHaveTextContent('Papel não encontrado')
  })

  it('usa mensagem padrão quando o carregamento falha sem Error', async () => {
    getRole.mockRejectedValue('x')
    renderAt('/roles/r404')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao carregar papel')
  })

  it('mantém o formulário e mostra o erro quando salvar falha', async () => {
    createRole.mockRejectedValue(new Error('Nome já utilizado'))
    renderAt('/roles/new')

    await userEvent.type(screen.getByLabelText('Nome'), 'Gestor')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Nome já utilizado')
    expect(screen.queryByText('Lista de papéis')).not.toBeInTheDocument()
  })

  it('usa mensagem padrão quando salvar falha sem Error', async () => {
    createRole.mockRejectedValue('x')
    renderAt('/roles/new')

    await userEvent.type(screen.getByLabelText('Nome'), 'Gestor')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao salvar papel')
  })
})
