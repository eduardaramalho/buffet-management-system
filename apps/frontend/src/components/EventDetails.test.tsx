import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventDetails } from './EventDetails'
import { getEventRuleMatches } from '../api/rulesApi'
import type { Event } from '../types/event'
import type { MatchedRule } from '../types/rule'

vi.mock('../api/rulesApi', () => ({
  getEventRuleMatches: vi.fn(),
}))

const event: Event = {
  id: 'event-1',
  name: 'Casamento Ana e Bruno',
  eventDate: '',
  endDate: null,
  location: 'Salão Jardim',
  serviceType: 'CASAMENTO',
  guestsCount: 150,
  observations: null,
  status: 'CONFIRMADO',
  createdById: 'actor-1',
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  services: [],
}

const matches: MatchedRule[] = [
  {
    rule: {
      id: 'rule-1',
      name: 'Casamento grande precisa de bar',
      description: 'Regra de exemplo',
      isActive: true,
      conditionServiceTypeIn: ['CASAMENTO'],
      conditionMinGuests: 100,
      conditionMaxGuests: null,
      conditionRequiredServiceIds: null,
      createdById: 'actor-1',
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
      resourceRequirements: [{ id: 'req-1', specialty: 'BAR', minQuantity: 2 }],
    },
    resourceRequirements: [{ id: 'req-1', specialty: 'BAR', minQuantity: 2 }],
  },
]

describe('EventDetails', () => {
  it('shows the event summary and does not test rules automatically', () => {
    render(<EventDetails event={event} onClose={vi.fn()} />)

    expect(screen.getByText('Casamento Ana e Bruno')).toBeInTheDocument()
    expect(getEventRuleMatches).not.toHaveBeenCalled()
  })

  it('tests the rules and displays the matched rules with their required resources', async () => {
    vi.mocked(getEventRuleMatches).mockResolvedValue(matches)
    render(<EventDetails event={event} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Testar regra' }))

    expect(await screen.findByText('Casamento grande precisa de bar')).toBeInTheDocument()
    expect(getEventRuleMatches).toHaveBeenCalledWith('event-1')
    expect(screen.getByText('Regra de exemplo')).toBeInTheDocument()
    expect(screen.getByText('Recursos exigidos: BAR ×2')).toBeInTheDocument()
  })

  it('shows a message when no rule matches the event', async () => {
    vi.mocked(getEventRuleMatches).mockResolvedValue([])
    render(<EventDetails event={event} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Testar regra' }))

    expect(await screen.findByText('Nenhuma regra corresponde a este evento.')).toBeInTheDocument()
  })
})
