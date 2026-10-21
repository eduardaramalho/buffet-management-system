import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarChart } from './BarChart'

describe('BarChart', () => {
  it('renders one labelled bar per item, scaled to the largest value', () => {
    render(<BarChart title="Eventos por status" items={[{ label: 'Confirmado', value: 4 }, { label: 'Cancelado', value: 1, color: '#c24c43' }]} />)

    const chart = screen.getByRole('figure', { name: 'Eventos por status' })
    const rows = within(chart).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Confirmado')).toBeInTheDocument()
    expect(within(rows[0]).getByText('4')).toBeInTheDocument()
    expect(rows[0].querySelector<HTMLElement>('.bar-fill')?.style.width).toBe('100%')
    expect(rows[1].querySelector<HTMLElement>('.bar-fill')?.style.width).toBe('25%')
    expect(rows[1].querySelector<HTMLElement>('.bar-fill')?.style.background).toBe('rgb(194, 76, 67)')
  })

  it('uses a fixed maximum and a custom value format when given (percentages)', () => {
    render(<BarChart title="Pontualidade" max={100} format={(value) => `${value}%`} items={[{ label: 'Cozinha', value: 50 }]} />)

    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(document.querySelector<HTMLElement>('.bar-fill')?.style.width).toBe('50%')
  })

  it('shows an empty message when there is nothing to plot', () => {
    render(<BarChart title="Vazio" items={[{ label: 'A', value: 0 }]} />)

    expect(screen.getByText('Sem dados no período.')).toBeInTheDocument()
  })
})
