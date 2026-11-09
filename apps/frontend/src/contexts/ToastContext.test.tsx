import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOAST_DURATION_MS, ToastProvider } from './ToastContext'
import { useToast } from './toast'

function Trigger() {
  const toast = useToast()
  return <>
    <button type="button" onClick={() => toast.success('Equipe criada.')}>Salvar</button>
    <button type="button" onClick={() => toast.error('Movimento não permitido.')}>Falhar</button>
  </>
}

describe('ToastProvider', () => {
  afterEach(() => vi.useRealTimers())

  it('announces the success message and hides it after a few seconds', () => {
    vi.useFakeTimers()
    render(<ToastProvider><Trigger /></ToastProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByRole('status')).toHaveTextContent('Equipe criada.')

    act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS) })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('can be dismissed by the user', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(screen.queryByText('Equipe criada.')).not.toBeInTheDocument()
  })

  it('does nothing outside the provider', () => {
    render(<Trigger />)
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))).not.toThrow()
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Falhar' }))).not.toThrow()
  })

  // KAN-77: feedback de um movimento recusado no quadro, com aparência de erro.
  it('shows an error toast with the error style', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Falhar' }))

    expect(screen.getByText('Movimento não permitido.').closest('.toast')).toHaveClass('toast-error')
  })
})
