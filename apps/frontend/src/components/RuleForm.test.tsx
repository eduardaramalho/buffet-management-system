import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RuleForm } from './RuleForm'
import { createRule, updateRule } from '../api/rulesApi'
import { listServices } from '../api/servicesApi'
import type { Rule } from '../types/rule'

vi.mock('../api/rulesApi', () => ({
  createRule: vi.fn(),
  updateRule: vi.fn(),
}))
vi.mock('../api/servicesApi', () => ({
  listServices: vi.fn(),
}))

const createdRule: Rule = {
  id: 'rule-1',
  name: 'Casamento grande precisa de bar',
  description: null,
  isActive: true,
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
}

describe('RuleForm', () => {
  it('validates the required name before creating a rule', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    render(<RuleForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Informe o nome da regra.')).toBeInTheDocument()
    expect(createRule).not.toHaveBeenCalled()
  })

  it('creates a rule with a condition and a resource requirement', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    vi.mocked(createRule).mockResolvedValue(createdRule)
    const onCreated = vi.fn()
    render(<RuleForm onClose={vi.fn()} onCreated={onCreated} onUpdated={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Nome da regra'), { target: { value: 'Casamento grande precisa de bar' } })
    fireEvent.click(screen.getByLabelText('Casamento'))
    fireEvent.change(screen.getByLabelText('Mínimo de convidados'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar recurso' }))
    fireEvent.change(screen.getByLabelText('Especialidade 1'), { target: { value: 'BAR' } })
    fireEvent.change(screen.getByLabelText('Quantidade mínima 1'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(createRule).toHaveBeenCalledWith({
      name: 'Casamento grande precisa de bar',
      description: null,
      conditionServiceTypeIn: ['CASAMENTO'],
      conditionMinGuests: 100,
      conditionMaxGuests: null,
      conditionRequiredServiceIds: null,
      resourceRequirements: [{ specialty: 'BAR', minQuantity: 2 }],
      taskTemplates: [],
    }))
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'rule-1' }))
  })

  it('edits an existing rule, pre-filling its fields', async () => {
    const existingRule: Rule = {
      ...createdRule,
      conditionServiceTypeIn: ['CASAMENTO'],
      conditionMinGuests: 50,
      resourceRequirements: [{ id: 'req-1', specialty: 'BAR', minQuantity: 1 }],
      taskTemplates: [{ id: 'tpl-1', ruleId: 'rule-1', title: 'Confirmar fornecedor', description: null, daysBeforeEvent: 7 }],
    }
    vi.mocked(listServices).mockResolvedValue([])
    vi.mocked(updateRule).mockResolvedValue({ ...existingRule, name: 'Regra atualizada' })
    const onUpdated = vi.fn()
    render(<RuleForm rule={existingRule} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={onUpdated} />)

    expect(screen.getByLabelText('Casamento')).toBeChecked()
    expect(screen.getByLabelText('Mínimo de convidados')).toHaveValue(50)
    fireEvent.change(screen.getByLabelText('Nome da regra'), { target: { value: 'Regra atualizada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(updateRule).toHaveBeenCalledWith('rule-1', expect.objectContaining({ name: 'Regra atualizada' })))
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ name: 'Regra atualizada' }))
  })

  it('adds, removes, and saves generated task templates', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    vi.mocked(createRule).mockResolvedValue(createdRule)
    render(<RuleForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Nome da regra'), { target: { value: 'Regra com tarefas' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa 1'), { target: { value: 'Confirmar fornecedor' } })
    fireEvent.change(screen.getByLabelText('Dias antes do evento 1'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remover tarefa 1' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa 1'), { target: { value: 'Separar materiais' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(createRule).toHaveBeenCalledWith(expect.objectContaining({
      taskTemplates: [{ title: 'Separar materiais', description: null, daysBeforeEvent: null }],
    })))
  })
})
