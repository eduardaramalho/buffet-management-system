import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResetPasswordPage } from './ResetPasswordPage'

const { resetPassword } = vi.hoisted(() => ({ resetPassword: vi.fn() }))
vi.mock('../api/authApi', () => ({ resetPassword }))

describe('ResetPasswordPage', () => {
  const renderAt = (url: string) => render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<p>Tela de login</p>} />
      </Routes>
    </MemoryRouter>,
  )
  const submitPassword = async (password: string) => {
    await userEvent.type(screen.getByLabelText('Nova senha'), password)
    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }))
  }

  beforeEach(() => { vi.clearAllMocks() })

  it('redefine a senha com o token da URL e redireciona para o login', async () => {
    resetPassword.mockResolvedValue(undefined)
    renderAt('/reset-password?token=abc123')

    await submitPassword('novaSenha123')

    expect(resetPassword).toHaveBeenCalledWith('abc123', 'novaSenha123')
    expect(await screen.findByRole('status')).toHaveTextContent('Senha redefinida com sucesso.')
    expect(await screen.findByText('Tela de login', {}, { timeout: 2000 })).toBeInTheDocument()
  })

  it('envia token vazio quando a URL não traz token, deixando o backend recusar', async () => {
    resetPassword.mockRejectedValue(new Error('Token inválido ou expirado'))
    renderAt('/reset-password')

    await submitPassword('novaSenha123')

    expect(resetPassword).toHaveBeenCalledWith('', 'novaSenha123')
    expect(await screen.findByRole('alert')).toHaveTextContent('Token inválido ou expirado')
  })

  it('usa mensagem padrão quando o erro não é uma instância de Error', async () => {
    resetPassword.mockRejectedValue('erro opaco')
    renderAt('/reset-password?token=abc123')

    await submitPassword('novaSenha123')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao redefinir senha')
  })

  it('exige nova senha com no mínimo 8 caracteres', () => {
    renderAt('/reset-password?token=abc123')

    // O jsdom não aplica minLength no submit; a garantia é o atributo nativo, validada pelo navegador.
    expect(screen.getByLabelText('Nova senha')).toBeRequired()
    expect(screen.getByLabelText('Nova senha')).toHaveAttribute('minLength', '8')
  })
})
