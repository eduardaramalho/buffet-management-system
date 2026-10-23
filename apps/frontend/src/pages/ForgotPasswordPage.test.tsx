import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ForgotPasswordPage } from './ForgotPasswordPage'

const { forgotPassword } = vi.hoisted(() => ({ forgotPassword: vi.fn() }))
vi.mock('../api/authApi', () => ({ forgotPassword }))

describe('ForgotPasswordPage', () => {
  const renderPage = () => render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>)
  const submitEmail = async (email: string) => {
    await userEvent.type(screen.getByLabelText('E-mail'), email)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar instruções' }))
  }

  beforeEach(() => { vi.clearAllMocks() })

  it('envia a solicitação e mostra mensagem neutra, sem revelar se o e-mail existe', async () => {
    forgotPassword.mockResolvedValue(undefined)
    renderPage()

    await submitEmail('ana@buffet.com')

    expect(forgotPassword).toHaveBeenCalledWith('ana@buffet.com')
    expect(await screen.findByRole('status')).toHaveTextContent('Se o e-mail existir, as instruções foram enviadas.')
  })

  it('exibe a mensagem do erro quando a solicitação falha', async () => {
    forgotPassword.mockRejectedValue(new Error('Muitas tentativas'))
    renderPage()

    await submitEmail('ana@buffet.com')

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas')
  })

  it('usa mensagem padrão quando o erro não é uma instância de Error', async () => {
    forgotPassword.mockRejectedValue('falha desconhecida')
    renderPage()

    await submitEmail('ana@buffet.com')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha na solicitação')
  })

  it('oferece o link de volta para o login', () => {
    renderPage()

    expect(screen.getByRole('link', { name: 'Voltar para o login' })).toHaveAttribute('href', '/login')
  })
})
