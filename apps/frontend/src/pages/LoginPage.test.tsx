import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError, type AxiosResponse } from 'axios'
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

  it('tells the user to contact the administrator instead of offering self-service recovery', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)

    expect(screen.getByText('Esqueceu a senha? Procure o administrador do sistema.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Esqueci minha senha' })).not.toBeInTheDocument()
  })

  it('shows the backend message when the temporary password expired', async () => {
    const message = 'Sua senha temporária expirou. Procure o administrador do sistema.'
    login.mockRejectedValue(new AxiosError('Request failed', '400', undefined, undefined, { status: 400, data: { message, code: 'TEMP_PASSWORD_EXPIRED' } } as AxiosResponse))
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText('E-mail'), 'alice@example.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'Abcd2345efgh')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })
})
