import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteErrorBoundary } from './RouteErrorBoundary'

let shouldThrow = true
function UnstablePage() {
  if (shouldThrow) throw new RangeError('Invalid time value')
  return <h1>Página carregada</h1>
}
const renderBoundary = (resetKey = '/events/1') => render(
  <MemoryRouter><RouteErrorBoundary resetKey={resetKey}><UnstablePage /></RouteErrorBoundary></MemoryRouter>,
)

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true
    // O React registra no console todo erro capturado por um boundary; aqui o erro é esperado.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows a recoverable message instead of a blank screen when the page throws', () => {
    renderBoundary()

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível exibir esta tela.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para o início' })).toHaveAttribute('href', '/')
    // Detalhes técnicos ficam fora da tela.
    expect(screen.queryByText(/Invalid time value/)).not.toBeInTheDocument()
  })

  it('remounts the page when the user retries, without reloading the browser', () => {
    renderBoundary()
    shouldThrow = false

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(screen.getByRole('heading', { name: 'Página carregada' })).toBeInTheDocument()
  })

  it('clears the error when the route changes', () => {
    const { rerender } = renderBoundary('/events/1')
    shouldThrow = false

    rerender(<MemoryRouter><RouteErrorBoundary resetKey="/tasks"><UnstablePage /></RouteErrorBoundary></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Página carregada' })).toBeInTheDocument()
  })
})
