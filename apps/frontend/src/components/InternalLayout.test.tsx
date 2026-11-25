import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InternalLayout } from './InternalLayout'
import { useAuth } from '../contexts/useAuth'
import { listTasks } from '../api/tasksApi'
import type { Task } from '../types/task'

vi.mock('../contexts/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/tasksApi', () => ({ listTasks: vi.fn().mockResolvedValue([]) }))

const permissions = ['dashboard:view', 'users:list', 'events:list', 'teams:list', 'collaborators:manage', 'clients:list', 'rules:list', 'tasks:list', 'roles:list', 'reports:view', 'services:list']
const makeUser = (roleNames: string[]) => ({ id: 'user-1', name: 'Alice', email: 'alice@example.com', mustChangePassword: false, roles: roleNames.map((name) => ({ name, permissions })) })

beforeEach(() => {
  localStorage.clear()
  vi.mocked(listTasks).mockReset().mockResolvedValue([])
  vi.mocked(useAuth).mockReturnValue({ user: makeUser(['Gestor']), loading: false, login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() })
})

describe('InternalLayout', () => {
  it.each([
    ['/rules', 'Regras'],
    ['/users', 'Usuários'],
    ['/collaborators', 'Colaboradores'],
    ['/clients', 'Clientes'],
    ['/services', 'Serviços'],
    ['/roles', 'Papéis e permissões'],
  ])('shows the breadcrumb for %s', (path, label) => {
    render(<MemoryRouter initialEntries={[path]}><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(within(document.querySelector('.breadcrumb') as HTMLElement).getByRole('strong')).toHaveTextContent(label)
  })

  it.each(['Gestor', 'Administrador'])('shows the real role %s in the layout', (roleName) => {
    vi.mocked(useAuth).mockReturnValue({ user: makeUser([roleName]), loading: false, login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() })
    render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getAllByText(roleName)).toHaveLength(2)
  })

  it('shows the services catalog entry only with services:list (RF06)', () => {
    render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Serviços' })).toHaveAttribute('href', '/services')

    vi.mocked(useAuth).mockReturnValue({ user: { ...makeUser(['Gestor']), roles: [{ name: 'Gestor', permissions: ['events:list'] }] }, loading: false, login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() })
    render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getAllByRole('link', { name: 'Serviços' })).toHaveLength(1)
  })

  it('shows the clients menu entry only with clients:list', () => {
    render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clients')

    vi.mocked(useAuth).mockReturnValue({ user: { ...makeUser(['Gestor']), roles: [{ name: 'Gestor', permissions: ['events:list'] }] }, loading: false, login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() })
    render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getAllByRole('link', { name: 'Clientes' })).toHaveLength(1)
  })

  it('shows the reports menu entry only with reports:view and labels the breadcrumb', () => {
    render(<MemoryRouter initialEntries={['/reports']}><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveAttribute('href', '/reports')
    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveClass('active')
    expect(screen.getByText('Relatórios', { selector: '.breadcrumb strong' })).toBeInTheDocument()

    vi.mocked(useAuth).mockReturnValue({ user: { ...makeUser(['Gestor']), roles: [{ name: 'Gestor', permissions: ['events:list'] }] }, loading: false, login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() })
    render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getAllByRole('link', { name: 'Relatórios' })).toHaveLength(1)
  })

  describe('badge de tarefas sem equipe', () => {
    const task = (overrides: Partial<Task>) => ({ id: 'task', status: 'PENDENTE', assignedTeamId: null, ...overrides }) as Task
    const renderLayout = () => render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)

    it('conta só as tarefas abertas sem equipe', async () => {
      vi.mocked(listTasks).mockResolvedValue([
        task({ id: 't1' }),
        task({ id: 't2', status: 'EM_ANDAMENTO' }),
        task({ id: 't3', assignedTeamId: 'team-1' }),
        task({ id: 't4', status: 'CONCLUIDA' }),
        task({ id: 't5', status: 'CANCELADA' }),
      ])
      renderLayout()
      expect(await within(screen.getByRole('link', { name: 'Tarefas' })).findByText('2')).toHaveClass('task-alert-badge')
    })

    it('não busca tarefas nem mostra o link sem tasks:list', () => {
      vi.mocked(useAuth).mockReturnValue({ user: { ...makeUser(['Gestor']), roles: [{ name: 'Gestor', permissions: ['events:list'] }] }, loading: false, login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() })
      renderLayout()
      expect(listTasks).not.toHaveBeenCalled()
      expect(screen.queryByRole('link', { name: 'Tarefas' })).not.toBeInTheDocument()
    })

    it('descarta a contagem de um usuário anterior que chega depois da troca de sessão', async () => {
      let resolveFirst: (tasks: Task[]) => void = () => undefined
      vi.mocked(listTasks)
        .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
        .mockResolvedValueOnce([task({ id: 't1' })])
      const { rerender } = renderLayout()
      vi.mocked(useAuth).mockReturnValue({ user: { ...makeUser(['Gestor']), id: 'user-2' }, loading: false, login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() })
      rerender(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
      const tasksLink = screen.getByRole('link', { name: 'Tarefas' })
      expect(await within(tasksLink).findByText('1')).toBeInTheDocument()

      await act(async () => { resolveFirst([task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })]) })
      expect(within(tasksLink).getByText('1')).toBeInTheDocument()
      expect(listTasks).toHaveBeenCalledTimes(2)
    })
  })

  describe('sidebar recolhível (KAN-80)', () => {
    const renderLayout = () => render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    const layout = () => document.querySelector('.internal-layout') as HTMLElement

    it('começa expandida, com o controle indicando o estado', () => {
      renderLayout()
      const toggle = screen.getByRole('button', { name: 'Recolher menu' })
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(toggle).toHaveAttribute('aria-controls', 'app-sidebar')
      expect(layout()).not.toHaveClass('sidebar-collapsed')
    })

    it('recolhe e expande pelo controle', async () => {
      const user = userEvent.setup()
      renderLayout()
      await user.click(screen.getByRole('button', { name: 'Recolher menu' }))
      expect(layout()).toHaveClass('sidebar-collapsed')
      expect(screen.getByRole('button', { name: 'Expandir menu' })).toHaveAttribute('aria-expanded', 'false')

      await user.click(screen.getByRole('button', { name: 'Expandir menu' }))
      expect(layout()).not.toHaveClass('sidebar-collapsed')
    })

    it('mantém a navegação acessível com a barra recolhida', async () => {
      const user = userEvent.setup()
      renderLayout()
      await user.click(screen.getByRole('button', { name: 'Recolher menu' }))
      const eventsLink = screen.getByRole('link', { name: 'Eventos' })
      expect(eventsLink).toHaveAttribute('href', '/events')
      expect(eventsLink).toHaveAttribute('title', 'Eventos')
      expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    })

    it('não mostra dica de título nos links com a barra expandida', () => {
      renderLayout()
      expect(screen.getByRole('link', { name: 'Eventos' })).not.toHaveAttribute('title')
    })

    it('lembra a escolha ao montar o layout de novo', async () => {
      const user = userEvent.setup()
      const { unmount } = renderLayout()
      await user.click(screen.getByRole('button', { name: 'Recolher menu' }))
      unmount()
      renderLayout()
      expect(layout()).toHaveClass('sidebar-collapsed')
      expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument()
    })
  })
})
