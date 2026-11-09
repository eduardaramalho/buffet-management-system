import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskFilterMenu } from './TaskFilterMenu'

const teams = [{ id: 'team-1', name: 'Cozinha' }, { id: 'team-2', name: 'Salão' }]
const events = [
  { id: 'event-2', name: 'Formatura', eventDate: '2026-11-21T15:00:00.000Z', status: 'CONFIRMADO' },
  { id: 'event-1', name: 'Casamento', eventDate: '2026-11-14T15:00:00.000Z', status: 'CONFIRMADO' },
  { id: 'event-3', name: '15 anos', eventDate: '2026-11-01T15:00:00.000Z', status: 'CONCLUIDO' },
]

const renderMenu = (overrides: Partial<Parameters<typeof TaskFilterMenu>[0]> = {}) => {
  const props = { teams, events, teamId: '', eventId: '', onTeamChange: vi.fn(), onEventChange: vi.fn(), onClear: vi.fn(), ...overrides }
  render(<TaskFilterMenu {...props} />)
  return props
}

describe('TaskFilterMenu', () => {
  it('keeps the filters hidden behind the three-dots button', () => {
    renderMenu()

    const toggle = screen.getByRole('button', { name: 'Filtros' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Equipe')).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Equipe')).toBeInTheDocument()
    expect(screen.getByLabelText('Evento')).toBeInTheDocument()
  })

  it('lists the events by date and marks the closed ones', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))

    const options = Array.from((screen.getByLabelText('Evento') as HTMLSelectElement).options).map((option) => option.textContent)
    expect(options).toEqual(['Todos os eventos', '15 anos · 01/11 (encerrado)', 'Casamento · 14/11', 'Formatura · 21/11'])
  })

  it('reports the chosen team and event', () => {
    const props = renderMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))

    fireEvent.change(screen.getByLabelText('Equipe'), { target: { value: 'team-2' } })
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'event-1' } })

    expect(props.onTeamChange).toHaveBeenCalledWith('team-2')
    expect(props.onEventChange).toHaveBeenCalledWith('event-1')
  })

  it('shows how many filters are active and clears them', () => {
    const props = renderMenu({ teamId: 'team-1', eventId: 'event-1' })

    const toggle = screen.getByRole('button', { name: 'Filtros (2 ativos)' })
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    expect(props.onClear).toHaveBeenCalled()
  })

  it('uses the singular label with one active filter and disables clearing with none', () => {
    const { rerender } = render(<TaskFilterMenu teams={teams} events={events} teamId="" eventId="event-1" onTeamChange={vi.fn()} onEventChange={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Filtros (1 ativo)' })).toBeInTheDocument()

    rerender(<TaskFilterMenu teams={teams} events={events} teamId="" eventId="" onTeamChange={vi.fn()} onEventChange={vi.fn()} onClear={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeDisabled()
  })

  it('hides the team filter when the user cannot list teams', () => {
    renderMenu({ teams: null })
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))

    expect(screen.queryByLabelText('Equipe')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Evento')).toBeInTheDocument()
  })

  it('closes with Fechar, with Escape and when clicking outside', () => {
    renderMenu()
    const toggle = screen.getByRole('button', { name: 'Filtros' })

    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByLabelText('Evento')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    fireEvent.keyDown(screen.getByLabelText('Evento'), { key: 'Escape' })
    expect(screen.queryByLabelText('Evento')).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()

    fireEvent.click(toggle)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByLabelText('Evento')).not.toBeInTheDocument()
  })
})
