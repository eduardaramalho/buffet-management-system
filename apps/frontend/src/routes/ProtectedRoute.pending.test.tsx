import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'

const { authState } = vi.hoisted(() => ({ authState: { user: null as unknown } }))
vi.mock('../contexts/useAuth', () => ({ useAuth: () => authState }))

const renderAt = () => render(
  <MemoryRouter initialEntries={['/users']}>
    <Routes>
      <Route path="/users" element={<ProtectedRoute permission="users:list"><span>conteúdo privado</span></ProtectedRoute>} />
      <Route path="/change-password" element={<span>trocar senha</span>} />
    </Routes>
  </MemoryRouter>,
)

describe('ProtectedRoute with a pending password change', () => {
  it('sends the user to the password change before any private page', () => {
    authState.user = { id: '1', name: 'Bia', email: 'bia@buffet.com', mustChangePassword: true, roles: [{ name: 'gestor', permissions: ['users:list'] }] }
    renderAt()

    expect(screen.getByText('trocar senha')).toBeInTheDocument()
    expect(screen.queryByText('conteúdo privado')).not.toBeInTheDocument()
  })

  it('renders the page once the password was changed', () => {
    authState.user = { id: '1', name: 'Bia', email: 'bia@buffet.com', mustChangePassword: false, roles: [{ name: 'gestor', permissions: ['users:list'] }] }
    renderAt()

    expect(screen.getByText('conteúdo privado')).toBeInTheDocument()
  })
})
