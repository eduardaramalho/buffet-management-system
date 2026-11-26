import { StrictMode } from 'react'
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

const { setAccessToken, clearAccessToken, refreshSession } = vi.hoisted(() => ({ setAccessToken: vi.fn(), clearAccessToken: vi.fn(), refreshSession: vi.fn() }))
vi.mock('../api/httpClient', () => ({ setAccessToken, clearAccessToken, refreshSession }))

const alice = { id: '1', name: 'Alice', email: 'alice@example.com', mustChangePassword: false }
const noSessionCookie = () => Promise.reject({ response: { status: 400, data: { message: 'Sessão expirada' } } })

function Consumer() {
  const { user, loading, restoring, login, logout, changePassword } = useAuth()
  return <div>
    <span>{restoring ? 'restoring' : loading ? 'loading' : user?.name ?? 'anonymous'}</span>
    <span>{user?.mustChangePassword ? 'pending' : 'clear'}</span>
    <button onClick={() => { void changePassword('Abcd2345efgh', 'NovaSenha123').catch(() => undefined) }}>change</button>
    <button onClick={() => { void login('alice@example.com', 'secret123').catch(() => undefined) }}>login</button>
    <button onClick={() => void logout()}>logout</button>
  </div>
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshSession.mockImplementation(noSessionCookie)
  })

  it('restores the session from the refresh token cookie when the page loads', async () => {
    let resolveRefresh: (value: unknown) => void = () => undefined
    refreshSession.mockReturnValue(new Promise((resolve) => { resolveRefresh = resolve }))
    meApi.mockResolvedValue(alice)
    render(<AuthProvider><Consumer /></AuthProvider>)

    expect(screen.getByText('restoring')).toBeInTheDocument()
    resolveRefresh({ accessToken: 'access', user: alice })

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(meApi).toHaveBeenCalledTimes(1)
  })

  it('ends the restoration as anonymous when there is no valid session cookie', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>)

    expect(await screen.findByText('anonymous')).toBeInTheDocument()
    expect(meApi).not.toHaveBeenCalled()
    expect(clearAccessToken).toHaveBeenCalled()
  })

  it('ends the restoration as anonymous when the profile cannot be loaded', async () => {
    refreshSession.mockResolvedValue({ accessToken: 'access', user: alice })
    meApi.mockRejectedValue(new Error('Usuário indisponível'))
    render(<AuthProvider><Consumer /></AuthProvider>)

    expect(await screen.findByText('anonymous')).toBeInTheDocument()
    expect(clearAccessToken).toHaveBeenCalled()
  })

  it('starts the restored session only once under StrictMode', async () => {
    refreshSession.mockResolvedValue({ accessToken: 'access', user: alice })
    meApi.mockResolvedValue(alice)
    render(<StrictMode><AuthProvider><Consumer /></AuthProvider></StrictMode>)

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(meApi).toHaveBeenCalledTimes(1)
    expect(setAccessToken).toHaveBeenCalledTimes(1)
  })

  it('ignores a restoration that finishes after the provider unmounts', async () => {
    let settle: { resolve: (value: unknown) => void; reject: (reason: unknown) => void } = { resolve: () => undefined, reject: () => undefined }
    refreshSession.mockReturnValue(new Promise((resolve, reject) => { settle = { resolve, reject } }))
    const { unmount } = render(<AuthProvider><Consumer /></AuthProvider>)
    unmount()

    settle.reject(new Error('sem cookie'))
    await Promise.resolve()

    expect(clearAccessToken).not.toHaveBeenCalled()
    expect(meApi).not.toHaveBeenCalled()
  })

  it('does not store a profile that arrives after the provider unmounts', async () => {
    let resolveProfile: (value: unknown) => void = () => undefined
    refreshSession.mockResolvedValue({ accessToken: 'access', user: alice })
    meApi.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve }))
    const { unmount } = render(<AuthProvider><Consumer /></AuthProvider>)
    await vi.waitFor(() => expect(meApi).toHaveBeenCalled())
    unmount()

    resolveProfile(alice)
    await Promise.resolve()

    expect(setAccessToken).toHaveBeenCalledWith('access')
  })

  it('stores the user after a successful login', async () => {
    loginApi.mockResolvedValue({ user: alice, accessToken: 'access' })
    meApi.mockResolvedValue(alice)
    render(<AuthProvider><Consumer /></AuthProvider>)
    await screen.findByText('anonymous')

    await userEvent.click(screen.getByRole('button', { name: 'login' }))

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(setAccessToken).toHaveBeenCalledWith('access')
  })

  it('revokes the session cookie and clears the session on logout', async () => {
    loginApi.mockResolvedValue({ user: alice, accessToken: 'access' })
    meApi.mockResolvedValue(alice)
    logoutApi.mockResolvedValue(undefined)
    render(<AuthProvider><Consumer /></AuthProvider>)
    await screen.findByText('anonymous')
    await userEvent.click(screen.getByRole('button', { name: 'login' }))
    await screen.findByText('Alice')

    await userEvent.click(screen.getByRole('button', { name: 'logout' }))

    expect(await screen.findByText('anonymous')).toBeInTheDocument()
    expect(logoutApi).toHaveBeenCalledWith()
    expect(clearAccessToken).toHaveBeenCalled()
  })

  it('leaves the user anonymous when login fails', async () => {
    loginApi.mockRejectedValue(new Error('Credenciais inválidas'))
    render(<AuthProvider><Consumer /></AuthProvider>)
    await screen.findByText('anonymous')

    await userEvent.click(screen.getByRole('button', { name: 'login' }))

    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })

  it('replaces the session and clears the pending flag after the password change', async () => {
    loginApi.mockResolvedValue({ user: { ...alice, mustChangePassword: true }, accessToken: 'access' })
    meApi.mockResolvedValueOnce({ ...alice, mustChangePassword: true })
    meApi.mockResolvedValueOnce(alice)
    changePasswordApi.mockResolvedValue({ user: alice, accessToken: 'access-2' })
    render(<AuthProvider><Consumer /></AuthProvider>)
    await screen.findByText('anonymous')
    await userEvent.click(screen.getByRole('button', { name: 'login' }))
    expect(await screen.findByText('pending')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'change' }))

    expect(await screen.findByText('clear')).toBeInTheDocument()
    expect(changePasswordApi).toHaveBeenCalledWith('Abcd2345efgh', 'NovaSenha123')
    expect(setAccessToken).toHaveBeenLastCalledWith('access-2')
  })
})
