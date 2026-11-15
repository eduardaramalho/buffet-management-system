import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo } from './Logo'

describe('Logo', () => {
  it('mostra o nome do sistema e o subtítulo na versão completa', () => {
    const { container } = render(<Logo />)
    expect(screen.getByText('Eventos')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Gestão de Eventos')).toBeInTheDocument()
    expect(container.querySelector('.brand')).not.toHaveClass('compact')
  })

  it('omite o subtítulo na versão compacta do menu lateral', () => {
    const { container } = render(<Logo compact />)
    expect(screen.queryByText('Gestão de Eventos')).not.toBeInTheDocument()
    expect(container.querySelector('.brand')).toHaveClass('compact')
  })

  it('renderiza o ícone como decorativo, sem poluir o leitor de tela', () => {
    const { container } = render(<Logo />)
    const mark = container.querySelector('svg.logo-mark')
    expect(mark).toBeInTheDocument()
    expect(mark).toHaveAttribute('aria-hidden', 'true')
  })
})
