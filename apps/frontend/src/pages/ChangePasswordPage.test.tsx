import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangePasswordPage } from './ChangePasswordPage'

const { changePassword, logout } = vi.hoisted(() => ({ changePassword: vi.fn(), logout: vi.fn() }))

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: '1', name: 'Bia', email: 'bia@buffet.com', mustChangePassword: true }, loading: false, changePassword, logout }),
}))

const apiError = (status: number, message: string) =>
  new AxiosError(message, String(status), undefined, undefined, { status, data: { message } } as AxiosResponse)

const renderPage = () => render(
  <MemoryRouter initialEntries={['/change-password']}>
    <Routes>
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/" element={<span>painel inicial</span>} />
    </Routes>
  </MemoryRouter>,
)

const fill = async (current: string, next: string, confirmation: string) => {
  await userEvent.type(screen.getByLabelText('Senha atual'), current)
  await userEvent.type(screen.getByLabelText('Nova senha'), next)
  await userEvent.type(screen.getByLabelText('Confirmar nova senha'), confirmation)
  await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
}

describe('ChangePasswordPage', () => {
  beforeEach(() => { changePassword.mockReset(); logout.mockReset() })

  it('explains that the temporary password must be replaced', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Defina uma nova senha' })).toBeInTheDocument()
    expect(screen.getByText(/senha temporária/i)).toBeInTheDocument()
  })

  it('changes the password and goes to the home page', async () => {
    changePassword.mockResolvedValue(undefined)
    renderPage()

    await fill('Abcd2345efgh', 'NovaSenha123', 'NovaSenha123')

    expect(changePassword).toHaveBeenCalledWith('Abcd2345efgh', 'NovaSenha123')
    expect(await screen.findByText('painel inicial')).toBeInTheDocument()
  })

  it('does not submit when the confirmation does not match', async () => {
    renderPage()

    await fill('Abcd2345efgh', 'NovaSenha123', 'OutraSenha123')

    expect(changePassword).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('A confirmação não confere com a nova senha')
  })

  it('does not submit when the new password repeats the current one', async () => {
    renderPage()

    await fill('Abcd2345efgh', 'Abcd2345efgh', 'Abcd2345efgh')

    expect(changePassword).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('A nova senha precisa ser diferente da atual')
  })

  it('shows the API message when the change is rejected', async () => {
    changePassword.mockRejectedValue(apiError(400, 'Senha atual incorreta'))
    renderPage()

    await fill('errada123', 'NovaSenha123', 'NovaSenha123')

    expect(await screen.findByRole('alert')).toHaveTextContent('Senha atual incorreta')
    expect(screen.queryByText('painel inicial')).not.toBeInTheDocument()
  })

  it('lets the user leave without changing the password', async () => {
    logout.mockResolvedValue(undefined)
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(logout).toHaveBeenCalled()
  })
})
