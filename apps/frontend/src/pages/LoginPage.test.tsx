import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const { login, auth } = vi.hoisted(() => ({ login: vi.fn(), auth: { loading: false } }))

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ user: null, loading: auth.loading, login, logout: vi.fn() }),
}))

const renderPage = () => render(<MemoryRouter><LoginPage /></MemoryRouter>)

const submit = async (password = 'secret123') => {
  await userEvent.type(screen.getByLabelText('E-mail'), 'alice@example.com')
  await userEvent.type(screen.getByLabelText('Senha'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('LoginPage', () => {
  beforeEach(() => { login.mockReset(); auth.loading = false })

  it('submits credentials successfully', async () => {
    login.mockResolvedValue(undefined)
    renderPage()
    await submit()

    expect(login).toHaveBeenCalledWith('alice@example.com', 'secret123')
  })

  it('uses the form as the page heading and keeps the slogan out of the heading outline', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Acesse sua conta' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByText('Organize. Planeje. Execute.')).toBeInTheDocument()
  })

  it('lets the browser fill the saved credentials and does not validate the password length on login', () => {
    renderPage()

    expect(screen.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByLabelText('Senha')).not.toHaveAttribute('minlength')
  })

  it('shows the API error when login fails', async () => {
    login.mockRejectedValue(new Error('Credenciais inválidas'))
    renderPage()
    await submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Credenciais inválidas')
    expect(alert).toHaveClass('error')
  })

  it('explains how to recover the password only when the user asks for it', async () => {
    renderPage()
    const toggle = screen.getByRole('button', { name: 'Esqueceu a senha?' })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Como recuperar a senha' })).not.toBeInTheDocument()

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: 'Como recuperar a senha' })).toHaveTextContent('Procure o administrador do sistema')

    await userEvent.click(toggle)

    expect(screen.queryByRole('region', { name: 'Como recuperar a senha' })).not.toBeInTheDocument()
  })

  it('does not offer self-service recovery by e-mail', () => {
    renderPage()

    expect(screen.queryByRole('link', { name: 'Esqueci minha senha' })).not.toBeInTheDocument()
  })

  it('does not offer a "remember me" option, since the session lives only in memory', () => {
    renderPage()

    expect(screen.queryByRole('checkbox', { name: 'Lembrar de mim' })).not.toBeInTheDocument()
  })

  it('shows the expired temporary password as a warning with the backend message', async () => {
    const message = 'Sua senha temporária expirou. Procure o administrador do sistema.'
    login.mockRejectedValue(new AxiosError('Request failed', '400', undefined, undefined, { status: 400, data: { message, code: 'TEMP_PASSWORD_EXPIRED' } } as AxiosResponse))
    renderPage()
    await submit('Abcd2345efgh')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(message)
    expect(alert).toHaveClass('warning')
    expect(alert).not.toHaveClass('error')
  })

  it('shows the progress on the submit button while the login is running', () => {
    auth.loading = true
    renderPage()

    expect(screen.getByRole('button', { name: 'Entrando...' })).toBeDisabled()
  })
})
