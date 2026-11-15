import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOADING_INDICATOR_DELAY_MS, LoadBoundary } from './LoadBoundary'

describe('LoadBoundary', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('hides the content while loading and only shows the indicator if the load takes longer than the delay', () => {
    render(<LoadBoundary status="loading" error=""><p>Conteúdo</p></LoadBoundary>)

    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS - 1) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole('status')).toHaveTextContent('Carregando...')
  })

  it('accepts a custom loading label and marks the region as busy', () => {
    const { container } = render(<LoadBoundary status="loading" error="" label="Carregando clientes..."><p>Conteúdo</p></LoadBoundary>)
    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS) })
    expect(screen.getByRole('status')).toHaveTextContent('Carregando clientes...')
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  it('never shows the indicator when the data arrives before the delay', () => {
    const { rerender } = render(<LoadBoundary status="loading" error=""><p>Conteúdo</p></LoadBoundary>)
    rerender(<LoadBoundary status="ready" error=""><p>Conteúdo</p></LoadBoundary>)
    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS * 2) })

    expect(screen.getByText('Conteúdo')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the error with a retry action instead of the content', () => {
    const onRetry = vi.fn()
    render(<LoadBoundary status="error" error="Erro ao carregar clientes" onRetry={onRetry}><p>Conteúdo</p></LoadBoundary>)

    expect(screen.getByRole('alert')).toHaveTextContent('Erro ao carregar clientes')
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('omits the retry button when there is no retry action', () => {
    render(<LoadBoundary status="error" error="Falhou"><p>Conteúdo</p></LoadBoundary>)
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  })
})
