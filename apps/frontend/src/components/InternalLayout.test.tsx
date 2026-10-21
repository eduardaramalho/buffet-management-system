import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InternalLayout } from './InternalLayout'
import { useAuth } from '../contexts/useAuth'

vi.mock('../contexts/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/tasksApi', () => ({ listTasks: vi.fn().mockResolvedValue([]) }))

const permissions = ['dashboard:view', 'users:list', 'events:list', 'teams:list', 'collaborators:manage', 'clients:list', 'rules:list', 'tasks:list', 'roles:list', 'reports:view']
const makeUser = (roleNames: string[]) => ({ id: 'user-1', name: 'Alice', email: 'alice@example.com', roles: roleNames.map((name) => ({ name, permissions })) })

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ user: makeUser(['Gestor']), loading: false, login: vi.fn(), logout: vi.fn() })
})

describe('InternalLayout', () => {
  it.each([
    ['/rules', 'Regras'],
    ['/users', 'Usuários'],
    ['/collaborators', 'Colaboradores'],
    ['/clients', 'Clientes'],
    ['/roles', 'Papéis e permissões'],
  ])('shows the breadcrumb for %s', (path, label) => {
    render(<MemoryRouter initialEntries={[path]}><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(within(document.querySelector('.breadcrumb') as HTMLElement).getByRole('strong')).toHaveTextContent(label)
  })

  it.each(['Gestor', 'Administrador'])('shows the real role %s in the layout', (roleName) => {
    vi.mocked(useAuth).mockReturnValue({ user: makeUser([roleName]), loading: false, login: vi.fn(), logout: vi.fn() })
    render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getAllByText(roleName)).toHaveLength(2)
  })

  it('shows the clients menu entry only with clients:list', () => {
    render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clients')

    vi.mocked(useAuth).mockReturnValue({ user: { ...makeUser(['Gestor']), roles: [{ name: 'Gestor', permissions: ['events:list'] }] }, loading: false, login: vi.fn(), logout: vi.fn() })
    render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getAllByRole('link', { name: 'Clientes' })).toHaveLength(1)
  })

  it('shows the reports menu entry only with reports:view and labels the breadcrumb', () => {
    render(<MemoryRouter initialEntries={['/reports']}><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveAttribute('href', '/reports')
    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveClass('active')
    expect(screen.getByText('Relatórios', { selector: '.breadcrumb strong' })).toBeInTheDocument()

    vi.mocked(useAuth).mockReturnValue({ user: { ...makeUser(['Gestor']), roles: [{ name: 'Gestor', permissions: ['events:list'] }] }, loading: false, login: vi.fn(), logout: vi.fn() })
    render(<MemoryRouter><InternalLayout onLogout={vi.fn()}><div>Conteúdo</div></InternalLayout></MemoryRouter>)
    expect(screen.getAllByRole('link', { name: 'Relatórios' })).toHaveLength(1)
  })
})
