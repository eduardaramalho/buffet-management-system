import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

const { loginApi, logoutApi, meApi } = vi.hoisted(() => ({ loginApi: vi.fn(), logoutApi: vi.fn(), meApi: vi.fn() }))

vi.mock('../api/authApi', () => ({
  login: loginApi,
  logout: logoutApi,
  me: meApi,
}))

function Consumer() {
  const { user, loading, login, logout } = useAuth()
  return <div>
    <span>{loading ? 'loading' : user?.name ?? 'anonymous'}</span>
    <button onClick={() => { void login('alice@example.com', 'secret123').catch(() => undefined) }}>login</button>
    <button onClick={() => void logout()}>logout</button>
  </div>
}

describe('AuthContext', () => {
  beforeEach(() => {
    loginApi.mockReset()
    logoutApi.mockReset()
    meApi.mockReset()
  })

  it('stores the user after a successful login', async () => {
    loginApi.mockResolvedValue({ user: { id: '1', name: 'Alice', email: 'alice@example.com' }, accessToken: 'access', refreshToken: 'refresh' })
    meApi.mockResolvedValue({ id: '1', name: 'Alice', email: 'alice@example.com' })
    render(<AuthProvider><Consumer /></AuthProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'login' }))

    expect(await screen.findByText('Alice')).toBeInTheDocument()
  })

  it('clears the session on logout', async () => {
    loginApi.mockResolvedValue({ user: { id: '1', name: 'Alice', email: 'alice@example.com' }, accessToken: 'access', refreshToken: 'refresh' })
    meApi.mockResolvedValue({ id: '1', name: 'Alice', email: 'alice@example.com' })
    render(<AuthProvider><Consumer /></AuthProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'login' }))
    await userEvent.click(await screen.findByRole('button', { name: 'logout' }))

    expect(screen.getByText('anonymous')).toBeInTheDocument()
    expect(logoutApi).toHaveBeenCalledWith('refresh')
  })

  it('leaves the user anonymous when login fails', async () => {
    loginApi.mockRejectedValue(new Error('Credenciais inválidas'))
    render(<AuthProvider><Consumer /></AuthProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'login' }))

    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })
})