import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RolesListPage } from './RolesListPage'

const { listRoles } = vi.hoisted(() => ({ listRoles: vi.fn() }))
vi.mock('../api/rolesApi', () => ({ listRoles }))

describe('RolesListPage', () => {
  it('lista os papéis com link para edição e atalho para criar um novo', async () => {
    listRoles.mockResolvedValue([
      { id: 'r1', name: 'Gestor', description: 'Gerencia eventos' },
      { id: 'r2', name: 'Operador', description: null },
    ])
    render(<MemoryRouter><RolesListPage /></MemoryRouter>)

    expect(await screen.findByRole('link', { name: 'Gestor' })).toHaveAttribute('href', '/roles/r1')
    expect(screen.getByRole('link', { name: 'Operador' })).toHaveAttribute('href', '/roles/r2')
    expect(screen.getByText('Gerencia eventos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Novo papel' })).toHaveAttribute('href', '/roles/new')
  })
})
