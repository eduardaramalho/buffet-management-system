import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const login = vi.fn()

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false, login, logout: vi.fn() }),
}))

describe('LoginPage', () => {
  it('submits credentials successfully', async () => {
    login.mockResolvedValue(undefined)
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText('E-mail'), 'alice@example.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(login).toHaveBeenCalledWith('alice@example.com', 'secret123')
  })

  it('shows the API error when login fails', async () => {
    login.mockRejectedValue(new Error('Credenciais inválidas'))
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText('E-mail'), 'alice@example.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciais inválidas')
  })
})