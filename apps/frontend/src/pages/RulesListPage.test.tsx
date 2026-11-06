import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RulesListPage } from './RulesListPage'
import { listRules, removeRule, setRuleActive } from '../api/rulesApi'
import { listServices } from '../api/servicesApi'
import type { Rule } from '../types/rule'

vi.mock('../api/rulesApi', () => ({
  listRules: vi.fn(),
  setRuleActive: vi.fn(),
  removeRule: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
}))
vi.mock('../api/servicesApi', () => ({ listServices: vi.fn() }))

const rules: Rule[] = [
  {
    id: 'rule-1',
    name: 'Casamento grande precisa de bar',
    description: null,
    isActive: true,
    conditionServiceTypeIn: ['CASAMENTO'],
    conditionMinGuests: 100,
    conditionMaxGuests: null,
    conditionRequiredServiceIds: null,
    createdById: 'actor-1',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    resourceRequirements: [{ id: 'req-1', specialty: 'BAR', minQuantity: 1 }],
    taskTemplates: [
      { id: 'tpl-1', ruleId: 'rule-1', title: 'Confirmar fornecedor', description: null, daysBeforeEvent: 7 },
      { id: 'tpl-2', ruleId: 'rule-1', title: 'Separar materiais', description: null, daysBeforeEvent: null },
      { id: 'tpl-3', ruleId: 'rule-1', title: 'Montar salão', description: null, daysBeforeEvent: 1 },
    ],
  },
  {
    id: 'rule-2',
    name: 'Regra inativa de limpeza',
    description: null,
    isActive: false,
    conditionServiceTypeIn: null,
    conditionMinGuests: null,
    conditionMaxGuests: null,
    conditionRequiredServiceIds: null,
    createdById: 'actor-1',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    resourceRequirements: [],
    taskTemplates: [],
  },
]

describe('RulesListPage', () => {
  it('loads and displays the rules returned by the API, with summary counts', async () => {
    vi.mocked(listRules).mockResolvedValue(rules)

    render(<RulesListPage />)

    expect(await screen.findByText('Casamento grande precisa de bar')).toBeInTheDocument()
    expect(screen.getByText('Regra inativa de limpeza')).toBeInTheDocument()
    expect(screen.getByText('Total de regras')).toBeInTheDocument()
    expect(screen.getByText('Regras ativas')).toBeInTheDocument()
    expect(screen.getByText('Inativas')).toBeInTheDocument()
    expect(screen.getByText('3 tarefas')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma')).toBeInTheDocument()
  })

  it('shows the empty state without breaking when there are no rules', async () => {
    vi.mocked(listRules).mockResolvedValue([])

    render(<RulesListPage />)

    expect(await screen.findByText('Nenhuma regra encontrada.')).toBeInTheDocument()
    expect(listRules).toHaveBeenCalledWith({ search: undefined })
  })

  it('opens the form for a new rule and for editing an existing rule', async () => {
    vi.mocked(listRules).mockResolvedValue(rules)
    vi.mocked(listServices).mockResolvedValue([])

    render(<RulesListPage />)
    await screen.findByText('Casamento grande precisa de bar')

    fireEvent.click(screen.getByRole('button', { name: 'Nova regra' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nova regra' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Editar Casamento grande precisa de bar' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Editar regra' })).toBeInTheDocument()
  })

  it('toggles a rule status after confirmation', async () => {
    vi.mocked(listRules).mockResolvedValue(rules)
    vi.mocked(setRuleActive).mockResolvedValue({ ...rules[1], isActive: true })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<RulesListPage />)
    await screen.findByText('Regra inativa de limpeza')

    fireEvent.click(screen.getByRole('button', { name: 'Ativar Regra inativa de limpeza' }))

    await waitFor(() => expect(setRuleActive).toHaveBeenCalledWith('rule-2', true))
  })

  it('removes a rule after confirmation', async () => {
    vi.mocked(listRules).mockResolvedValue(rules)
    vi.mocked(removeRule).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<RulesListPage />)
    await screen.findByText('Regra inativa de limpeza')

    fireEvent.click(screen.getByRole('button', { name: 'Excluir Regra inativa de limpeza' }))

    await waitFor(() => expect(removeRule).toHaveBeenCalledWith('rule-2'))
    await waitFor(() => expect(screen.queryByText('Regra inativa de limpeza')).not.toBeInTheDocument())
  })
})
