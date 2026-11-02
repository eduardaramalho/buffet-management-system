import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResetPasswordDialog } from './ResetPasswordDialog'

const { resetUserPassword } = vi.hoisted(() => ({ resetUserPassword: vi.fn() }))
vi.mock('../api/usersApi', () => ({ resetUserPassword }))

const user = { id: 'user-2', name: 'Bruno', email: 'bruno@buffet.com', isActive: true, roles: [{ role: { id: 'r1', name: 'colaborador', isProtected: false } }] }

describe('ResetPasswordDialog', () => {
  beforeEach(() => { resetUserPassword.mockReset() })

  it('asks for confirmation before resetting', () => {
    render(<ResetPasswordDialog user={user} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog')).toHaveTextContent('Bruno')
    expect(resetUserPassword).not.toHaveBeenCalled()
  })

  it('shows the temporary password once, with its expiration and a copy button', async () => {
    resetUserPassword.mockResolvedValue({ temporaryPassword: 'Abcd2345efgh', expiresAt: '2026-10-28T15:00:00.000Z' })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<ResetPasswordDialog user={user} onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    expect(resetUserPassword).toHaveBeenCalledWith('user-2')
    expect(await screen.findByText('Abcd2345efgh')).toBeInTheDocument()
    expect(screen.getByText(/não será exibida novamente/i)).toBeInTheDocument()
    expect(screen.getByText(/Válida até/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Copiar senha' }))
    expect(writeText).toHaveBeenCalledWith('Abcd2345efgh')
    expect(await screen.findByText('Senha copiada')).toBeInTheDocument()
  })

  it('closes from the result step', async () => {
    resetUserPassword.mockResolvedValue({ temporaryPassword: 'Abcd2345efgh', expiresAt: '2026-10-28T15:00:00.000Z' })
    const onClose = vi.fn()
    render(<ResetPasswordDialog user={user} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Concluir' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('shows the API error and keeps the confirmation step', async () => {
    resetUserPassword.mockRejectedValue(new AxiosError('x', '409', undefined, undefined, { status: 409, data: { message: 'Reative o usuário antes de redefinir a senha' } } as AxiosResponse))
    render(<ResetPasswordDialog user={user} onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Reative o usuário antes de redefinir a senha')
    expect(screen.getByRole('button', { name: 'Redefinir senha' })).toBeEnabled()
  })

  it('can be cancelled before resetting', async () => {
    const onClose = vi.fn()
    render(<ResetPasswordDialog user={user} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalled()
    expect(resetUserPassword).not.toHaveBeenCalled()
  })
})
