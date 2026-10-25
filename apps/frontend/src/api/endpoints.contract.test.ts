import { beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from './httpClient'
import * as authApi from './authApi'
import * as clientsApi from './clientsApi'
import * as collaboratorsApi from './collaboratorsApi'
import * as dashboardApi from './dashboardApi'
import * as eventsApi from './eventsApi'
import * as rolesApi from './rolesApi'
import * as rulesApi from './rulesApi'
import * as servicesApi from './servicesApi'
import * as tasksApi from './tasksApi'
import * as teamsApi from './teamsApi'
import * as usersApi from './usersApi'

/**
 * Teste de contrato dos adaptadores HTTP do frontend.
 * Cada caso fixa o verbo, a rota versionada (/api/v1) e o payload que o backend espera,
 * de modo que uma divergência de contrato quebre o build em vez de falhar em produção.
 */
vi.mock('./httpClient', () => ({
  httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete'
type ContractCase = {
  name: string
  call: () => Promise<unknown>
  verb: Verb
  args: unknown[]
  /** Funções que retornam void não expõem o corpo da resposta. */
  returnsData?: boolean
}

const RESPONSE = { id: 'response-id' }
const filters = { search: 'x' }

const cases: ContractCase[] = [
  // auth
  { name: 'authApi.login', call: () => authApi.login('a@b.com', 'secret123'), verb: 'post', args: ['/api/v1/auth/login', { email: 'a@b.com', password: 'secret123' }] },
  { name: 'authApi.refresh', call: () => authApi.refresh('rt-1'), verb: 'post', args: ['/api/v1/auth/refresh-token', { refreshToken: 'rt-1' }] },
  { name: 'authApi.logout', call: () => authApi.logout('rt-1'), verb: 'post', args: ['/api/v1/auth/logout', { refreshToken: 'rt-1' }], returnsData: false },
  { name: 'authApi.forgotPassword', call: () => authApi.forgotPassword('a@b.com'), verb: 'post', args: ['/api/v1/auth/forgot-password', { email: 'a@b.com' }], returnsData: false },
  { name: 'authApi.resetPassword', call: () => authApi.resetPassword('tk', 'secret123'), verb: 'post', args: ['/api/v1/auth/reset-password', { token: 'tk', password: 'secret123' }], returnsData: false },
  { name: 'authApi.me', call: () => authApi.me(), verb: 'get', args: ['/api/v1/auth/me'] },
  // users
  { name: 'usersApi.listUsers (com busca)', call: () => usersApi.listUsers('ana'), verb: 'get', args: ['/api/v1/users', { params: { search: 'ana' } }] },
  { name: 'usersApi.listUsers (busca vazia é omitida)', call: () => usersApi.listUsers(), verb: 'get', args: ['/api/v1/users', { params: { search: undefined } }] },
  { name: 'usersApi.getUser', call: () => usersApi.getUser('u1'), verb: 'get', args: ['/api/v1/users/u1'] },
  { name: 'usersApi.createUser', call: () => usersApi.createUser({ name: 'Ana', email: 'a@b.com', password: 'secret123', roleId: 'r1' }), verb: 'post', args: ['/api/v1/users', { name: 'Ana', email: 'a@b.com', password: 'secret123', roleId: 'r1' }] },
  { name: 'usersApi.updateUser', call: () => usersApi.updateUser('u1', { name: 'Ana' }), verb: 'put', args: ['/api/v1/users/u1', { name: 'Ana' }] },
  { name: 'usersApi.setUserActive (ativar)', call: () => usersApi.setUserActive('u1', true), verb: 'patch', args: ['/api/v1/users/u1/activate'] },
  { name: 'usersApi.setUserActive (desativar)', call: () => usersApi.setUserActive('u1', false), verb: 'patch', args: ['/api/v1/users/u1/deactivate'] },
  // roles
  { name: 'rolesApi.listRoles', call: () => rolesApi.listRoles(), verb: 'get', args: ['/api/v1/roles'] },
  { name: 'rolesApi.getRole', call: () => rolesApi.getRole('r1'), verb: 'get', args: ['/api/v1/roles/r1'] },
  { name: 'rolesApi.createRole', call: () => rolesApi.createRole({ name: 'Gestor' }), verb: 'post', args: ['/api/v1/roles', { name: 'Gestor' }] },
  { name: 'rolesApi.updateRole', call: () => rolesApi.updateRole('r1', { description: 'd' }), verb: 'put', args: ['/api/v1/roles/r1', { description: 'd' }] },
  { name: 'rolesApi.listPermissions', call: () => rolesApi.listPermissions(), verb: 'get', args: ['/api/v1/roles/permissions'] },
  { name: 'rolesApi.assignPermission', call: () => rolesApi.assignPermission('r1', 'p1'), verb: 'post', args: ['/api/v1/roles/r1/permissions', { permissionId: 'p1' }], returnsData: false },
  { name: 'rolesApi.revokePermission', call: () => rolesApi.revokePermission('r1', 'p1'), verb: 'delete', args: ['/api/v1/roles/r1/permissions', { data: { permissionId: 'p1' } }], returnsData: false },
  // clients
  { name: 'clientsApi.listClients', call: () => clientsApi.listClients(filters), verb: 'get', args: ['/api/v1/clients', { params: filters }] },
  { name: 'clientsApi.listClients (sem filtros)', call: () => clientsApi.listClients(), verb: 'get', args: ['/api/v1/clients', { params: {} }] },
  { name: 'clientsApi.createClient', call: () => clientsApi.createClient({ name: 'Cliente' } as never), verb: 'post', args: ['/api/v1/clients', { name: 'Cliente' }] },
  { name: 'clientsApi.updateClient', call: () => clientsApi.updateClient('c1', { name: 'Cliente' }), verb: 'put', args: ['/api/v1/clients/c1', { name: 'Cliente' }] },
  { name: 'clientsApi.removeClient', call: () => clientsApi.removeClient('c1'), verb: 'delete', args: ['/api/v1/clients/c1'], returnsData: false },
  // collaborators
  { name: 'collaboratorsApi.listCollaborators', call: () => collaboratorsApi.listCollaborators(filters), verb: 'get', args: ['/api/v1/collaborators', { params: filters }] },
  { name: 'collaboratorsApi.listCollaborators (sem filtros)', call: () => collaboratorsApi.listCollaborators(), verb: 'get', args: ['/api/v1/collaborators', { params: {} }] },
  { name: 'collaboratorsApi.getCollaborator', call: () => collaboratorsApi.getCollaborator('k1'), verb: 'get', args: ['/api/v1/collaborators/k1'] },
  { name: 'collaboratorsApi.createCollaborator', call: () => collaboratorsApi.createCollaborator({ name: 'Bia' } as never), verb: 'post', args: ['/api/v1/collaborators', { name: 'Bia' }] },
  { name: 'collaboratorsApi.updateCollaborator', call: () => collaboratorsApi.updateCollaborator('k1', { name: 'Bia' } as never), verb: 'put', args: ['/api/v1/collaborators/k1', { name: 'Bia' }] },
  { name: 'collaboratorsApi.setCollaboratorActive', call: () => collaboratorsApi.setCollaboratorActive('k1', false), verb: 'patch', args: ['/api/v1/collaborators/k1/status', { active: false }] },
  // dashboard
  { name: 'dashboardApi.getDashboardSummary', call: () => dashboardApi.getDashboardSummary(), verb: 'get', args: ['/api/v1/dashboard/summary'] },
  { name: 'dashboardApi.getUpcomingEvents (padrão)', call: () => dashboardApi.getUpcomingEvents(), verb: 'get', args: ['/api/v1/dashboard/upcoming-events', { params: { limit: 5 } }] },
  { name: 'dashboardApi.getUpcomingEvents', call: () => dashboardApi.getUpcomingEvents(3), verb: 'get', args: ['/api/v1/dashboard/upcoming-events', { params: { limit: 3 } }] },
  { name: 'dashboardApi.getTasksByStatus', call: () => dashboardApi.getTasksByStatus(), verb: 'get', args: ['/api/v1/dashboard/tasks-by-status'] },
  { name: 'dashboardApi.getRecentActivity (padrão)', call: () => dashboardApi.getRecentActivity(), verb: 'get', args: ['/api/v1/dashboard/recent-activity', { params: { limit: 10 } }] },
  // events
  { name: 'eventsApi.listEvents', call: () => eventsApi.listEvents(filters as never), verb: 'get', args: ['/api/v1/events', { params: filters }] },
  { name: 'eventsApi.listEvents (sem filtros)', call: () => eventsApi.listEvents(), verb: 'get', args: ['/api/v1/events', { params: {} }] },
  { name: 'eventsApi.getEvent', call: () => eventsApi.getEvent('e1'), verb: 'get', args: ['/api/v1/events/e1'] },
  { name: 'eventsApi.createEvent', call: () => eventsApi.createEvent({ name: 'Festa' } as never), verb: 'post', args: ['/api/v1/events', { name: 'Festa' }] },
  { name: 'eventsApi.updateEvent', call: () => eventsApi.updateEvent('e1', { name: 'Festa' } as never), verb: 'put', args: ['/api/v1/events/e1', { name: 'Festa' }] },
  { name: 'eventsApi.listDeletedEvents', call: () => eventsApi.listDeletedEvents(), verb: 'get', args: ['/api/v1/events/deleted'] },
  { name: 'eventsApi.restoreEvent', call: () => eventsApi.restoreEvent('e1'), verb: 'patch', args: ['/api/v1/events/e1/restore'] },
  { name: 'eventsApi.removeEvent', call: () => eventsApi.removeEvent('e1'), verb: 'delete', args: ['/api/v1/events/e1'], returnsData: false },
  { name: 'eventsApi.attachEventService', call: () => eventsApi.attachEventService('e1', 's1', 'Mesa extra'), verb: 'post', args: ['/api/v1/events/e1/services', { serviceId: 's1', customLabel: 'Mesa extra' }] },
  { name: 'eventsApi.detachEventService', call: () => eventsApi.detachEventService('e1', 's1'), verb: 'delete', args: ['/api/v1/events/e1/services/s1'], returnsData: false },
  { name: 'eventsApi.getEventHistory', call: () => eventsApi.getEventHistory('e1'), verb: 'get', args: ['/api/v1/events/e1/history'] },
  { name: 'eventsApi.getReplicationPreview', call: () => eventsApi.getReplicationPreview('e1', { eventDate: '2026-12-12T18:00:00.000Z', endDate: null }), verb: 'get', args: ['/api/v1/events/e1/replication-preview', { params: { eventDate: '2026-12-12T18:00:00.000Z' } }] },
  { name: 'eventsApi.getReplicationPreview (com término)', call: () => eventsApi.getReplicationPreview('e1', { eventDate: '2026-12-12T18:00:00.000Z', endDate: '2026-12-13T02:00:00.000Z' }), verb: 'get', args: ['/api/v1/events/e1/replication-preview', { params: { eventDate: '2026-12-12T18:00:00.000Z', endDate: '2026-12-13T02:00:00.000Z' } }] },
  { name: 'eventsApi.replicateEvent', call: () => eventsApi.replicateEvent('e1', { name: 'Festa' } as never), verb: 'post', args: ['/api/v1/events/e1/replicate', { name: 'Festa' }] },
  // services
  { name: 'servicesApi.listServices', call: () => servicesApi.listServices(), verb: 'get', args: ['/api/v1/services'] },
  { name: 'servicesApi.createService', call: () => servicesApi.createService('Bar'), verb: 'post', args: ['/api/v1/services', { name: 'Bar' }] },
  { name: 'servicesApi.updateService', call: () => servicesApi.updateService('s1', 'Bar 2'), verb: 'put', args: ['/api/v1/services/s1', { name: 'Bar 2' }] },
  { name: 'servicesApi.removeService', call: () => servicesApi.removeService('s1'), verb: 'delete', args: ['/api/v1/services/s1'], returnsData: false },
  // rules
  { name: 'rulesApi.listRules', call: () => rulesApi.listRules(filters as never), verb: 'get', args: ['/api/v1/rules', { params: filters }] },
  { name: 'rulesApi.listRules (sem filtros)', call: () => rulesApi.listRules(), verb: 'get', args: ['/api/v1/rules', { params: {} }] },
  { name: 'rulesApi.getRule', call: () => rulesApi.getRule('ru1'), verb: 'get', args: ['/api/v1/rules/ru1'] },
  { name: 'rulesApi.createRule', call: () => rulesApi.createRule({ name: 'Regra' } as never), verb: 'post', args: ['/api/v1/rules', { name: 'Regra' }] },
  { name: 'rulesApi.updateRule', call: () => rulesApi.updateRule('ru1', { name: 'Regra' } as never), verb: 'put', args: ['/api/v1/rules/ru1', { name: 'Regra' }] },
  { name: 'rulesApi.removeRule', call: () => rulesApi.removeRule('ru1'), verb: 'delete', args: ['/api/v1/rules/ru1'], returnsData: false },
  { name: 'rulesApi.setRuleActive (ativar)', call: () => rulesApi.setRuleActive('ru1', true), verb: 'patch', args: ['/api/v1/rules/ru1/activate'] },
  { name: 'rulesApi.setRuleActive (desativar)', call: () => rulesApi.setRuleActive('ru1', false), verb: 'patch', args: ['/api/v1/rules/ru1/deactivate'] },
  { name: 'rulesApi.getEventRuleMatches', call: () => rulesApi.getEventRuleMatches('e1'), verb: 'get', args: ['/api/v1/events/e1/rule-matches'] },
  { name: 'rulesApi.listEventRuleApplications', call: () => rulesApi.listEventRuleApplications('e1'), verb: 'get', args: ['/api/v1/events/e1/rule-applications'] },
  { name: 'rulesApi.applyEventRules', call: () => rulesApi.applyEventRules('e1'), verb: 'post', args: ['/api/v1/events/e1/apply-rules', {}] },
  // tasks
  { name: 'tasksApi.listTasks', call: () => tasksApi.listTasks(filters as never), verb: 'get', args: ['/api/v1/tasks', { params: filters }] },
  { name: 'tasksApi.listTasks (sem filtros)', call: () => tasksApi.listTasks(), verb: 'get', args: ['/api/v1/tasks', { params: {} }] },
  { name: 'tasksApi.getTask', call: () => tasksApi.getTask('t1'), verb: 'get', args: ['/api/v1/tasks/t1'] },
  { name: 'tasksApi.updateTaskStatus', call: () => tasksApi.updateTaskStatus('t1', 'CONCLUIDA' as never), verb: 'patch', args: ['/api/v1/tasks/t1/status', { status: 'CONCLUIDA' }] },
  { name: 'tasksApi.createTask', call: () => tasksApi.createTask({ title: 'T' } as never), verb: 'post', args: ['/api/v1/tasks', { title: 'T' }] },
  { name: 'tasksApi.updateTask', call: () => tasksApi.updateTask('t1', { title: 'T' } as never), verb: 'put', args: ['/api/v1/tasks/t1', { title: 'T' }] },
  { name: 'tasksApi.removeTask', call: () => tasksApi.removeTask('t1'), verb: 'delete', args: ['/api/v1/tasks/t1'], returnsData: false },
  // teams
  { name: 'teamsApi.listTeams', call: () => teamsApi.listTeams(filters as never), verb: 'get', args: ['/api/v1/teams', { params: filters }] },
  { name: 'teamsApi.listTeams (sem filtros)', call: () => teamsApi.listTeams(), verb: 'get', args: ['/api/v1/teams', { params: {} }] },
  { name: 'teamsApi.getTeam', call: () => teamsApi.getTeam('tm1'), verb: 'get', args: ['/api/v1/teams/tm1'] },
  { name: 'teamsApi.createTeam', call: () => teamsApi.createTeam({ name: 'Cozinha' } as never), verb: 'post', args: ['/api/v1/teams', { name: 'Cozinha' }] },
  { name: 'teamsApi.updateTeam', call: () => teamsApi.updateTeam('tm1', { name: 'Cozinha' } as never), verb: 'put', args: ['/api/v1/teams/tm1', { name: 'Cozinha' }] },
  { name: 'teamsApi.setTeamActive (ativar)', call: () => teamsApi.setTeamActive('tm1', true), verb: 'patch', args: ['/api/v1/teams/tm1/activate'] },
  { name: 'teamsApi.setTeamActive (desativar)', call: () => teamsApi.setTeamActive('tm1', false), verb: 'patch', args: ['/api/v1/teams/tm1/deactivate'] },
  { name: 'teamsApi.addTeamMember (padrão)', call: () => teamsApi.addTeamMember('tm1', 'k1'), verb: 'post', args: ['/api/v1/teams/tm1/members', { collaboratorId: 'k1', isLeader: false }] },
  { name: 'teamsApi.addTeamMember (líder)', call: () => teamsApi.addTeamMember('tm1', 'k1', true), verb: 'post', args: ['/api/v1/teams/tm1/members', { collaboratorId: 'k1', isLeader: true }] },
  { name: 'teamsApi.removeTeamMember', call: () => teamsApi.removeTeamMember('tm1', 'k1'), verb: 'delete', args: ['/api/v1/teams/tm1/members/k1'], returnsData: false },
  { name: 'teamsApi.listTeamsByEvent', call: () => teamsApi.listTeamsByEvent('e1'), verb: 'get', args: ['/api/v1/teams/events/e1'] },
  { name: 'teamsApi.listEventsByTeam', call: () => teamsApi.listEventsByTeam('tm1'), verb: 'get', args: ['/api/v1/teams/tm1/events'] },
  { name: 'teamsApi.assignTeamToEvent', call: () => teamsApi.assignTeamToEvent('tm1', 'e1'), verb: 'post', args: ['/api/v1/teams/tm1/events/e1'] },
  { name: 'teamsApi.unassignTeamFromEvent', call: () => teamsApi.unassignTeamFromEvent('tm1', 'e1'), verb: 'delete', args: ['/api/v1/teams/tm1/events/e1'], returnsData: false },
]

describe('contrato dos adaptadores HTTP (/api/v1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const verb of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      vi.mocked(httpClient[verb]).mockResolvedValue({ data: RESPONSE })
    }
  })

  it.each(cases)('$name chama $verb com rota e payload esperados', async ({ call, verb, args, returnsData = true }) => {
    const result = await call()

    expect(httpClient[verb]).toHaveBeenCalledTimes(1)
    expect(httpClient[verb]).toHaveBeenCalledWith(...args)
    expect(result).toEqual(returnsData ? RESPONSE : undefined)
  })
})
