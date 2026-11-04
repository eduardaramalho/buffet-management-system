import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventDetailsPage } from './EventDetailsPage'
import { getEvent, getEventHistory, updateEvent } from '../api/eventsApi'
import { listTasks } from '../api/tasksApi'
import { listTeams, listTeamsByEvent } from '../api/teamsApi'
import { applyEventRules, getEventRuleMatches, listEventRuleApplications } from '../api/rulesApi'
import type { Event } from '../types/event'
import type { MatchedRule } from '../types/rule'
import type { Task } from '../types/task'
import type { Team } from '../types/team'

vi.mock('../api/eventsApi', () => ({ getEvent: vi.fn(), getEventHistory: vi.fn(), updateEvent: vi.fn() }))
vi.mock('../api/tasksApi', () => ({ listTasks: vi.fn() }))
vi.mock('../api/teamsApi', () => ({ listTeams: vi.fn(), listTeamsByEvent: vi.fn() }))
vi.mock('../api/rulesApi', () => ({ applyEventRules: vi.fn(), getEventRuleMatches: vi.fn(), listEventRuleApplications: vi.fn() }))
const auth = vi.hoisted(() => ({ permissions: ['events:read', 'events:update', 'rules:apply'] }))
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { roles: [{ permissions: auth.permissions }] } }) }))
// The dialog has its own tests; here only its contract with the page matters (open, close, hand over the replica).
vi.mock('../components/ReplicateEventDialog', () => ({
  ReplicateEventDialog: ({ source, onClose, onReplicated }: { source: Event; onClose: () => void; onReplicated: (replica: Event) => void }) => <div role="dialog" aria-label="Replicar evento">
    <span>Base: {source.name}</span>
    <button type="button" onClick={onClose}>Fechar diálogo</button>
    <button type="button" onClick={() => onReplicated({ ...source, id: 'replica-1', name: 'Casamento Bruna' })}>Simular réplica</button>
  </div>,
}))

const event = (status: Event['status'] = 'CONFIRMADO'): Event => ({
  id: 'event-1', name: 'Casamento Ana', eventDate: '2026-11-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO', guestsCount: 100,
  observations: null, status, createdById: 'user', createdAt: '', updatedAt: '', deletedAt: null, services: [],
  clientId: 'client-1', client: { id: 'client-1', name: 'Ana Souza', email: 'ana@email.com', phone: '47999990000', deletedAt: null },
})
const matchedRule: MatchedRule = {
  rule: {
    id: 'rule-1', name: 'Casamento grande', description: null, conditionServiceTypeIn: ['CASAMENTO'], conditionMinGuests: 100, conditionMaxGuests: null,
    conditionRequiredServiceIds: null, isActive: true, createdById: 'user', createdAt: '', updatedAt: '', deletedAt: null, resourceRequirements: [], taskTemplates: [],
  },
  resourceRequirements: [{ id: 'req-1', specialty: 'COZINHA', minQuantity: 1 }],
}
const mockOtherBlocks = () => {
  vi.mocked(listTasks).mockResolvedValue([])
  vi.mocked(listTeamsByEvent).mockResolvedValue([])
  vi.mocked(listTeams).mockResolvedValue([])
  vi.mocked(getEventHistory).mockResolvedValue([])
}
const renderPage = () => render(<MemoryRouter initialEntries={['/events/event-1']}><Routes><Route path="/events/:id" element={<EventDetailsPage />} /></Routes></MemoryRouter>)

describe('EventDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.permissions = ['events:read', 'events:update', 'rules:apply']
  })

  it('renders independent event blocks and the next status action', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    vi.mocked(listTasks).mockResolvedValue([])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockResolvedValue([{ ruleId: 'rule-1', ruleName: 'Casamento', appliedAt: '2026-10-01T10:00:00.000Z' }])
    vi.mocked(getEventHistory).mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Casamento Ana')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar evento' })).toBeInTheDocument()
    expect(screen.getByText('Regras aplicadas')).toBeInTheDocument()
  })

  it('hides a forbidden block and retries other errors locally', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    vi.mocked(listTasks).mockRejectedValue({ response: { status: 403 } })
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockRejectedValue(new Error('falha de regras'))
    vi.mocked(getEventHistory).mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('falha de regras')).toBeInTheDocument()
    expect(screen.queryByText('Tarefas do evento')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(listEventRuleApplications).toHaveBeenCalledTimes(2))
  })

  it('requires a reason when cancelling a confirmed event', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    vi.mocked(listTasks).mockResolvedValue([])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockResolvedValue([])
    vi.mocked(getEventHistory).mockResolvedValue([])
    renderPage()
    await screen.findByText('Casamento Ana')

    fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar evento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))

    expect(await screen.findByText('Informe o motivo do cancelamento.')).toBeInTheDocument()
    expect(updateEvent).not.toHaveBeenCalled()
  })

  it('reapplies rules and reports created and skipped tasks', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    vi.mocked(listTasks).mockResolvedValue([])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockResolvedValue([])
    vi.mocked(getEventHistory).mockResolvedValue([])
    vi.mocked(applyEventRules).mockResolvedValue({ tasksCreated: 2, tasksSkipped: 1, teamsAutoAssigned: 0, alertsGenerated: 0 })
    renderPage()
    await screen.findByText('Casamento Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Reaplicar' }))
    await waitFor(() => expect(applyEventRules).toHaveBeenCalledWith('event-1'))
    expect(await screen.findByText('2 tarefas criadas, 1 ignorada')).toBeInTheDocument()
  })

  it('shows the event client contact in the client panel', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    vi.mocked(listTasks).mockResolvedValue([])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockResolvedValue([])
    vi.mocked(getEventHistory).mockResolvedValue([])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Cliente' })).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('ana@email.com')).toBeInTheDocument()
    expect(screen.getByText('47999990000')).toBeInTheDocument()
  })

  it('flags legacy events without a client and inactive clients', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({ ...event(), clientId: null, client: null })
    vi.mocked(listTasks).mockResolvedValue([])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockResolvedValue([])
    vi.mocked(getEventHistory).mockResolvedValue([])
    const { unmount } = renderPage()

    expect(await screen.findByText('Nenhum cliente vinculado. Edite o evento para vincular um cliente.')).toBeInTheDocument()
    unmount()

    vi.mocked(getEvent).mockResolvedValueOnce({ ...event(), client: { id: 'client-1', name: 'Ana Souza', email: null, phone: null, deletedAt: '2026-10-01T00:00:00.000Z' } })
    renderPage()

    expect(await screen.findByText('Cliente inativo')).toBeInTheDocument()
    expect(screen.getByText('Sem contato cadastrado')).toBeInTheDocument()
  })

  // Regressão encontrada pelo E2E: loadRules lia o status do evento de um estado ainda não atualizado
  // (closure), então um evento em planejamento consultava as regras APLICADAS e mostrava "nenhuma regra".
  it('shows the rules matching an event that is still in planning', async () => {
    vi.mocked(getEvent).mockResolvedValue(event('PLANEJAMENTO'))
    mockOtherBlocks()
    vi.mocked(getEventRuleMatches).mockResolvedValue([matchedRule])
    vi.mocked(listEventRuleApplications).mockResolvedValue([])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Motor de regras' })).toBeInTheDocument()
    expect(await screen.findByText('Casamento grande')).toBeInTheDocument()
    expect(listEventRuleApplications).not.toHaveBeenCalled()
  })

  // Regressão da "tela branca": ao confirmar, o painel passava a renderizar regras aplicadas com os
  // dados de regras combinadas (sem appliedAt) e Intl.DateTimeFormat lançava RangeError.
  it('confirms an event and shows the applied rules without leaving the page', async () => {
    vi.mocked(getEvent).mockResolvedValue(event('PLANEJAMENTO'))
    mockOtherBlocks()
    vi.mocked(getEventRuleMatches).mockResolvedValue([matchedRule])
    vi.mocked(listEventRuleApplications).mockResolvedValue([{ ruleId: 'rule-1', ruleName: 'Casamento grande', appliedAt: '2026-10-22T20:00:00.000Z' }])
    vi.mocked(updateEvent).mockResolvedValue(event('CONFIRMADO'))
    renderPage()
    await screen.findByText('Casamento grande')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('heading', { name: 'Regras aplicadas' })).toBeInTheDocument()
    expect(await screen.findByText(/Aplicada em/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Casamento Ana' })).toBeInTheDocument()
    expect(updateEvent).toHaveBeenCalledWith('event-1', { status: 'CONFIRMADO' })
  })
})

const task = (overrides: Partial<Task>): Task => ({
  id: 'task', eventId: 'event-1', title: 'Tarefa', description: null, dueDate: null, status: 'PENDENTE', assignedTeamId: 'team-1',
  sourceRuleId: null, createdAt: '', updatedAt: '', deletedAt: null, ...overrides,
})
const team = (overrides: Partial<Team>): Team => ({
  id: 'team-1', name: 'Cozinha', specialty: 'COZINHA', status: 'ATIVA', observations: null, createdById: 'user',
  createdAt: '', updatedAt: '', deletedAt: null, members: [], events: [], ...overrides,
} as Team)
const mockReadyBlocks = () => {
  mockOtherBlocks()
  vi.mocked(listEventRuleApplications).mockResolvedValue([])
}

describe('EventDetailsPage: estados da Central do evento', () => {
  beforeEach(() => vi.clearAllMocks())

  it('informa falta de acesso quando o evento retorna 403', async () => {
    vi.mocked(getEvent).mockRejectedValue({ response: { status: 403 } })
    renderPage()

    expect(await screen.findByText('Você não tem acesso a este evento.')).toBeInTheDocument()
  })

  it('mostra o erro do evento e tenta carregar de novo', async () => {
    vi.mocked(getEvent).mockRejectedValueOnce(new Error('Servidor indisponível')).mockResolvedValue(event())
    mockReadyBlocks()
    renderPage()

    expect(await screen.findByText('Servidor indisponível')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Casamento Ana' })).toBeInTheDocument()
  })

  it('resume o progresso, sinaliza tarefas sem equipe e rotula cada status', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.mocked(getEvent).mockResolvedValue(event())
    mockReadyBlocks()
    vi.mocked(listTasks).mockResolvedValue([
      task({ id: 't1', title: 'Montar buffet', status: 'PENDENTE', assignedTeamId: null, dueDate: '2026-11-09T12:00:00.000Z' }),
      task({ id: 't2', title: 'Servir jantar', status: 'EM_ANDAMENTO' }),
      task({ id: 't3', title: 'Comprar insumos', status: 'CONCLUIDA' }),
      task({ id: 't4', title: 'Decoração extra', status: 'CANCELADA', assignedTeamId: null }),
    ])
    renderPage()

    expect(await screen.findByText('1 de 3')).toBeInTheDocument()
    expect(screen.getByText('1 tarefa precisam de atenção.')).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.getByText('Em andamento', { selector: '.badge, span' })).toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
    expect(screen.getByText('Cancelada')).toBeInTheDocument()
    expect(screen.getAllByText('Sem prazo')).toHaveLength(3)
    expect(screen.getByText(/^Prazo /)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Alocar equipe' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  // Mesma regra dos relatórios: aberta e com o prazo vencido. Concluída fora do prazo não é "atrasada".
  it('destaca as tarefas abertas com o prazo vencido', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    mockReadyBlocks()
    vi.mocked(listTasks).mockResolvedValue([
      task({ id: 't1', title: 'Confirmar fornecedor', status: 'PENDENTE', dueDate: '2020-01-01T12:00:00.000Z' }),
      task({ id: 't2', title: 'Fechar cardápio', status: 'CONCLUIDA', dueDate: '2020-01-01T12:00:00.000Z' }),
    ])
    renderPage()

    expect(await screen.findByText(/Prazo .* • Atrasada/)).toHaveClass('overdue')
    expect(screen.getAllByText(/Atrasada/)).toHaveLength(1)
  })

  it('pluraliza o alerta quando há várias tarefas sem equipe', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    mockReadyBlocks()
    vi.mocked(listTasks).mockResolvedValue([
      task({ id: 't1', assignedTeamId: null }),
      task({ id: 't2', assignedTeamId: null, status: 'EM_ANDAMENTO' }),
    ])
    renderPage()

    expect(await screen.findByText('2 tarefas precisam de atenção.')).toBeInTheDocument()
    expect(screen.getByText('0 de 2')).toBeInTheDocument()
  })

  it('lista equipes ativas e inativas e ignora vínculos de equipes desconhecidas', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    mockReadyBlocks()
    vi.mocked(listTeams).mockResolvedValue([team({ id: 'team-1', name: 'Cozinha' }), team({ id: 'team-2', name: 'Salão', status: 'INATIVA' })])
    vi.mocked(listTeamsByEvent).mockResolvedValue([
      { eventId: 'event-1', teamId: 'team-1', assignedAt: '2026-10-01T10:00:00.000Z', assignedById: 'user' },
      { eventId: 'event-1', teamId: 'team-2', assignedAt: '2026-10-02T10:00:00.000Z', assignedById: 'user' },
      { eventId: 'event-1', teamId: 'team-removida', assignedAt: '2026-10-03T10:00:00.000Z', assignedById: 'user' },
    ])
    renderPage()

    expect(await screen.findByText('Cozinha')).toBeInTheDocument()
    expect(screen.getByText('Salão')).toBeInTheDocument()
    expect(screen.getByText('Ativa')).toBeInTheDocument()
    expect(screen.getByText('Inativa')).toBeInTheDocument()
    expect(document.querySelectorAll('.team-list .team-row')).toHaveLength(2)
  })

  it('mostra estados vazios de equipes, tarefas, histórico e regras', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    mockReadyBlocks()
    renderPage()

    expect(await screen.findByText('Nenhuma equipe designada.')).toBeInTheDocument()
    expect(screen.getByText('0 de 0')).toBeInTheDocument()
    expect(screen.getByText('Nenhum registro no histórico.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma regra aplicada.')).toBeInTheDocument()
  })

  it('exibe o histórico com autor ou "Sistema" quando a ação foi automática', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    mockReadyBlocks()
    vi.mocked(getEventHistory).mockResolvedValue([
      { id: 'h1', action: 'CREATED', message: 'Evento criado', actorName: 'Eduarda', createdAt: '2026-10-01T10:00:00.000Z' },
      { id: 'h2', action: 'RULES', message: 'Regras aplicadas', actorName: null, createdAt: '2026-10-02T10:00:00.000Z' },
    ])
    renderPage()

    expect(await screen.findByText('Evento criado')).toBeInTheDocument()
    expect(screen.getByText(/^Eduarda ·/)).toBeInTheDocument()
    expect(screen.getByText(/^Sistema ·/)).toBeInTheDocument()
  })

  it('isola falhas de equipes, tarefas e histórico e recarrega cada bloco separadamente', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    mockReadyBlocks()
    vi.mocked(listTeamsByEvent).mockRejectedValue(new Error('falha de equipes'))
    vi.mocked(listTasks).mockRejectedValue(new Error('falha de tarefas'))
    vi.mocked(getEventHistory).mockRejectedValue(new Error('falha de histórico'))
    renderPage()

    expect(await screen.findByText('falha de equipes')).toBeInTheDocument()
    expect(screen.getByText('falha de tarefas')).toBeInTheDocument()
    expect(screen.getByText('falha de histórico')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Casamento Ana' })).toBeInTheDocument()

    for (const button of screen.getAllByRole('button', { name: 'Tentar de novo' })) fireEvent.click(button)

    await waitFor(() => {
      expect(listTeamsByEvent).toHaveBeenCalledTimes(2)
      expect(listTasks).toHaveBeenCalledTimes(2)
      expect(getEventHistory).toHaveBeenCalledTimes(2)
    })
  })

  it('oferece "Concluir" para evento em andamento e nenhuma transição para evento concluído', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce(event('EM_ANDAMENTO'))
    mockReadyBlocks()
    const { unmount } = renderPage()

    expect(await screen.findByRole('button', { name: 'Concluir' })).toBeInTheDocument()
    unmount()

    vi.mocked(getEvent).mockResolvedValueOnce(event('CONCLUIDO'))
    renderPage()

    await screen.findByRole('heading', { level: 1, name: 'Casamento Ana' })
    expect(screen.queryByRole('button', { name: /Confirmar$|Iniciar evento|Concluir/ })).not.toBeInTheDocument()
  })

  it('mostra o erro quando a mudança de status é recusada', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    mockReadyBlocks()
    vi.mocked(updateEvent).mockRejectedValue(new Error('Transição inválida'))
    renderPage()
    await screen.findByText('Casamento Ana')

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar evento' }))

    expect(await screen.findByText('Transição inválida')).toBeInTheDocument()
  })

  it('cancela evento em planejamento sem exigir motivo e envia o motivo quando informado', async () => {
    vi.mocked(getEvent).mockResolvedValue(event('PLANEJAMENTO'))
    mockOtherBlocks()
    vi.mocked(getEventRuleMatches).mockResolvedValue([])
    vi.mocked(updateEvent).mockResolvedValue(event('CANCELADO'))
    renderPage()
    await screen.findByText('Nenhuma regra corresponde ao evento.')

    fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar evento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))

    await waitFor(() => expect(updateEvent).toHaveBeenCalledWith('event-1', { status: 'CANCELADO' }))
  })

  it('envia o motivo ao cancelar um evento confirmado e permite voltar sem cancelar', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    mockReadyBlocks()
    vi.mocked(updateEvent).mockResolvedValue(event('CANCELADO'))
    renderPage()
    await screen.findByText('Casamento Ana')

    fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar evento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.queryByRole('heading', { name: 'Cancelar evento' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar evento' }))
    fireEvent.change(screen.getByLabelText('Motivo do cancelamento'), { target: { value: '  Cliente desistiu  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))

    await waitFor(() => expect(updateEvent).toHaveBeenCalledWith('event-1', { status: 'CANCELADO', reason: 'Cliente desistiu' }))
  })

  it('usa o singular ao reaplicar uma única tarefa e mostra falha ao reaplicar', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    mockReadyBlocks()
    vi.mocked(applyEventRules)
      .mockResolvedValueOnce({ tasksCreated: 1, tasksSkipped: 2, teamsAutoAssigned: 0, alertsGenerated: 0 })
      .mockRejectedValueOnce(new Error('Motor indisponível'))
    renderPage()
    await screen.findByText('Casamento Ana')

    fireEvent.click(screen.getByRole('button', { name: 'Reaplicar' }))
    expect(await screen.findByText('1 tarefa criadas, 2 ignoradas')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: 'Reaplicar' }))
    expect(await screen.findByText('Motor indisponível')).toBeInTheDocument()
  })

  it('lista requisitos de recursos das regras combinadas ou informa quando não há', async () => {
    vi.mocked(getEvent).mockResolvedValue(event('PLANEJAMENTO'))
    mockOtherBlocks()
    vi.mocked(getEventRuleMatches).mockResolvedValue([matchedRule, { ...matchedRule, rule: { ...matchedRule.rule, id: 'rule-2', name: 'Básica' }, resourceRequirements: [] }])
    renderPage()

    expect(await screen.findByText('COZINHA ×1')).toBeInTheDocument()
    expect(screen.getByText('Sem recursos exigidos')).toBeInTheDocument()
  })

  it('volta para a lista de eventos pelo cabeçalho', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    mockReadyBlocks()
    render(<MemoryRouter initialEntries={['/events/event-1']}><Routes><Route path="/events/:id" element={<EventDetailsPage />} /><Route path="/events" element={<p>Lista de eventos</p>} /></Routes></MemoryRouter>)
    await screen.findByText('Casamento Ana')

    fireEvent.click(screen.getByRole('button', { name: 'Eventos' }))

    expect(await screen.findByText('Lista de eventos')).toBeInTheDocument()
  })

  describe('replicação (RF25)', () => {
    beforeEach(() => { auth.permissions = ['events:read', 'events:update', 'rules:apply'] })
    const task = (overrides: Partial<Task> = {}): Task => ({
      id: 'task-1', eventId: 'event-1', title: 'Confirmar flores', description: null, dueDate: null, status: 'PENDENTE', assignedTeamId: 'team-1',
      sourceRuleId: null, createdAt: '', updatedAt: '', deletedAt: null, ...overrides,
    })

    it('oferece "Replicar evento" só com a permissão events:replicate', async () => {
      vi.mocked(getEvent).mockResolvedValue(event('CONCLUIDO'))
      vi.mocked(listEventRuleApplications).mockResolvedValue([])
      mockOtherBlocks()
      renderPage()

      expect(await screen.findByText('Casamento Ana')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Replicar evento' })).not.toBeInTheDocument()
    })

    it('abre o diálogo com o evento atual como base e fecha sem criar nada', async () => {
      auth.permissions = [...auth.permissions, 'events:replicate']
      vi.mocked(getEvent).mockResolvedValue(event('CONCLUIDO'))
      vi.mocked(listEventRuleApplications).mockResolvedValue([])
      mockOtherBlocks()
      renderPage()

      fireEvent.click(await screen.findByRole('button', { name: 'Replicar evento' }))
      expect(screen.getByRole('dialog', { name: 'Replicar evento' })).toHaveTextContent('Base: Casamento Ana')

      fireEvent.click(screen.getByRole('button', { name: 'Fechar diálogo' }))
      expect(screen.queryByRole('dialog', { name: 'Replicar evento' })).not.toBeInTheDocument()
    })

    it('leva para a Central do novo evento depois de replicar', async () => {
      auth.permissions = [...auth.permissions, 'events:replicate']
      vi.mocked(getEvent).mockResolvedValue(event('CONCLUIDO'))
      vi.mocked(listEventRuleApplications).mockResolvedValue([])
      mockOtherBlocks()
      render(<MemoryRouter initialEntries={['/events/event-1']}><Routes><Route path="/events/event-1" element={<EventDetailsPage />} /><Route path="/events/replica-1" element={<p>Central da réplica</p>} /></Routes></MemoryRouter>)

      fireEvent.click(await screen.findByRole('button', { name: 'Replicar evento' }))
      fireEvent.click(screen.getByRole('button', { name: 'Simular réplica' }))

      expect(await screen.findByText('Central da réplica')).toBeInTheDocument()
    })

    it('mostra de qual evento este foi replicado, com link, e os eventos criados a partir dele', async () => {
      vi.mocked(getEvent).mockResolvedValue({
        ...event('PLANEJAMENTO'),
        sourceEventId: 'source-1',
        sourceEvent: { id: 'source-1', name: 'Casamento Alice', eventDate: '2026-06-20T18:00:00.000Z', deletedAt: null },
        replicas: [{ id: 'replica-2', name: 'Casamento Clara', eventDate: '2027-02-10T18:00:00.000Z', status: 'PLANEJAMENTO' }],
      })
      vi.mocked(getEventRuleMatches).mockResolvedValue([])
      mockOtherBlocks()
      renderPage()

      const sourceLink = await screen.findByRole('link', { name: 'Casamento Alice' })
      expect(sourceLink).toHaveAttribute('href', '/events/source-1')
      expect(screen.getByText(/Replicado de/)).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Eventos criados a partir deste' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Casamento Clara' })).toHaveAttribute('href', '/events/replica-2')
    })

    it('indica a origem excluída sem link e omite o painel quando não há réplicas', async () => {
      vi.mocked(getEvent).mockResolvedValue({
        ...event('PLANEJAMENTO'),
        sourceEventId: 'source-1',
        sourceEvent: { id: 'source-1', name: 'Casamento Alice', eventDate: '2026-06-20T18:00:00.000Z', deletedAt: '2026-09-01T00:00:00.000Z' },
        replicas: [],
      })
      vi.mocked(getEventRuleMatches).mockResolvedValue([])
      mockOtherBlocks()
      renderPage()

      expect(await screen.findByText('Casamento Alice (excluído)')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Casamento Alice' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Eventos criados a partir deste' })).not.toBeInTheDocument()
    })

    it('mantém a origem visível depois de confirmar o evento (o PUT não devolve a linhagem)', async () => {
      const replica = {
        ...event('PLANEJAMENTO'),
        sourceEventId: 'source-1',
        sourceEvent: { id: 'source-1', name: 'Casamento Alice', eventDate: '2026-06-20T18:00:00.000Z', deletedAt: null },
        replicas: [],
      }
      vi.mocked(getEvent).mockResolvedValue(replica)
      vi.mocked(getEventRuleMatches).mockResolvedValue([])
      vi.mocked(listEventRuleApplications).mockResolvedValue([])
      vi.mocked(updateEvent).mockResolvedValue(event('CONFIRMADO'))
      mockOtherBlocks()
      renderPage()

      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }))

      expect(await screen.findByRole('button', { name: 'Iniciar evento' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Casamento Alice' })).toBeInTheDocument()
    })

    it('marca as tarefas copiadas do evento de origem', async () => {
      vi.mocked(getEvent).mockResolvedValue(event('PLANEJAMENTO'))
      vi.mocked(getEventRuleMatches).mockResolvedValue([])
      mockOtherBlocks()
      vi.mocked(listTasks).mockResolvedValue([task({ sourceTaskId: 'task-0' }), task({ id: 'task-2', title: 'Nova tarefa' })])
      renderPage()

      expect(await screen.findByText('Confirmar flores')).toBeInTheDocument()
      expect(screen.getAllByText('Copiada do evento de origem')).toHaveLength(1)
    })
  })
})
