import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

const { loginApi, logoutApi, meApi, changePasswordApi } = vi.hoisted(() => ({ loginApi: vi.fn(), logoutApi: vi.fn(), meApi: vi.fn(), changePasswordApi: vi.fn() }))

vi.mock('../api/authApi', () => ({
  login: loginApi,
  logout: logoutApi,
  me: meApi,
  changePassword: changePasswordApi,
}))

const { setAccessToken, setRefreshToken } = vi.hoisted(() => ({ setAccessToken: vi.fn(), setRefreshToken: vi.fn() }))
vi.mock('../api/httpClient', () => ({ setAccessToken, setRefreshToken, clearTokens: vi.fn(), getRefreshToken: () => 'refresh' }))

function Consumer() {
  const { user, loading, login, logout, changePassword } = useAuth()
  return <div>
    <span>{loading ? 'loading' : user?.name ?? 'anonymous'}</span>
    <span>{user?.mustChangePassword ? 'pending' : 'clear'}</span>
    <button onClick={() => { void changePassword('Abcd2345efgh', 'NovaSenha123').catch(() => undefined) }}>change</button>
    <button onClick={() => { void login('alice@example.com', 'secret123').catch(() => undefined) }}>login</button>
    <button onClick={() => void logout()}>logout</button>
  </div>
}

describe('AuthContext', () => {
  beforeEach(() => {
    loginApi.mockReset()
    logoutApi.mockReset()
    meApi.mockReset()
    changePasswordApi.mockReset()
    setAccessToken.mockReset()
    setRefreshToken.mockReset()
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

  it('replaces the session and clears the pending flag after the password change', async () => {
    loginApi.mockResolvedValue({ user: { id: '1', name: 'Alice', email: 'alice@example.com', mustChangePassword: true }, accessToken: 'access', refreshToken: 'refresh' })
    meApi.mockResolvedValueOnce({ id: '1', name: 'Alice', email: 'alice@example.com', mustChangePassword: true })
    meApi.mockResolvedValueOnce({ id: '1', name: 'Alice', email: 'alice@example.com', mustChangePassword: false })
    changePasswordApi.mockResolvedValue({ user: { id: '1', name: 'Alice', email: 'alice@example.com', mustChangePassword: false }, accessToken: 'access-2', refreshToken: 'refresh-2' })
    render(<AuthProvider><Consumer /></AuthProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'login' }))
    expect(await screen.findByText('pending')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'change' }))

    expect(await screen.findByText('clear')).toBeInTheDocument()
    expect(changePasswordApi).toHaveBeenCalledWith('Abcd2345efgh', 'NovaSenha123')
    expect(setAccessToken).toHaveBeenLastCalledWith('access-2')
    expect(setRefreshToken).toHaveBeenLastCalledWith('refresh-2')
  })
})
