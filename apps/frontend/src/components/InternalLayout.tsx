import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { listTasks } from '../api/tasksApi'
import { Avatar } from './Avatar'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed'

const breadcrumbLabels: Record<string, string> = {
  '/rules': 'Regras',
  '/users': 'Usuários',
  '/collaborators': 'Colaboradores',
  '/clients': 'Clientes',
  '/services': 'Serviços',
  '/roles': 'Papéis e permissões',
  '/reports': 'Relatórios',
}

type SideLinkProps = { to: string; label: string; icon: IconName; active: boolean; collapsed: boolean; children?: ReactNode }

// Com a barra recolhida só o ícone fica visível: o title mostra o nome ao passar o mouse
// e o aria-label mantém o link identificável para leitores de tela.
function SideLink({ to, label, icon, active, collapsed, children }: Readonly<SideLinkProps>) {
  return <Link aria-label={label} aria-current={active ? 'page' : undefined} title={collapsed ? label : undefined} to={to} className={`side-link${active ? ' active' : ''}`}><Icon name={icon} /><span>{label}</span>{children}</Link>
}

type NavItem = { to: string; label: string; icon: IconName; permission: string }
type NavSection = { id: string; title?: string; items: NavItem[] }

// KAN-96: o menu é montado a partir desta lista; uma seção sem nenhum link permitido não aparece,
// então um colaborador não vê títulos soltos como "Automação" e "Administração".
const navSections: NavSection[] = [
  { id: 'geral', items: [
    { to: '/', label: 'Dashboard', icon: 'home', permission: 'dashboard:view' },
    { to: '/reports', label: 'Relatórios', icon: 'chart', permission: 'reports:view' },
  ] },
  { id: 'operacao', title: 'Operação', items: [
    { to: '/events', label: 'Eventos', icon: 'calendar', permission: 'events:list' },
    { to: '/clients', label: 'Clientes', icon: 'contact', permission: 'clients:list' },
    { to: '/services', label: 'Serviços', icon: 'tag', permission: 'services:list' },
    { to: '/tasks', label: 'Tarefas', icon: 'tasks', permission: 'tasks:list' },
    { to: '/teams', label: 'Equipes', icon: 'users', permission: 'teams:list' },
    { to: '/collaborators', label: 'Colaboradores', icon: 'user', permission: 'collaborators:manage' },
  ] },
  { id: 'automacao', title: 'Automação', items: [
    { to: '/rules', label: 'Regras', icon: 'bolt', permission: 'rules:list' },
  ] },
  { id: 'administracao', title: 'Administração', items: [
    { to: '/users', label: 'Usuários', icon: 'key', permission: 'users:list' },
    { to: '/roles', label: 'Papéis e permissões', icon: 'shield', permission: 'roles:list' },
  ] },
]

export function InternalLayout({ children, onLogout }: Readonly<{ children: ReactNode; onLogout: () => Promise<void> }>) {
  const { user } = useAuth()
  const location = useLocation()
  const hasPermission = (permission: string) => user?.roles?.some((role) => role.permissions.includes(permission)) ?? false
  const roleLabel = user?.roles?.map((role) => role.name).join(', ') || 'Usuário'
  const breadcrumbLabel = Object.entries(breadcrumbLabels).find(([path]) => location.pathname.startsWith(path))?.[1] ?? (location.pathname === '/' ? 'Dashboard' : 'Administração')
  const [unassignedTaskCount, setUnassignedTaskCount] = useState(0)
  const { collapsed, toggle } = useSidebarCollapsed()
  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path))
  const visibleSections = navSections
    .map((section) => ({ ...section, items: section.items.filter((item) => hasPermission(item.permission)) }))
    .filter((section) => section.items.length > 0)

  const canListTasks = hasPermission('tasks:list')
  const userId = user?.id

  // Sem tasks:list o link de Tarefas (e o badge) nem aparece, então não há estado para zerar aqui.
  // A flag descarta a resposta de um usuário anterior que chegue depois da troca de sessão.
  useEffect(() => {
    if (!canListTasks || !userId) return undefined
    let active = true
    listTasks()
      .then((tasks) => { if (active) setUnassignedTaskCount(tasks.filter((task) => !task.assignedTeamId && task.status !== 'CONCLUIDA' && task.status !== 'CANCELADA').length) })
      .catch(() => { if (active) setUnassignedTaskCount(0) })
    return () => { active = false }
  }, [canListTasks, userId])

  return <div className={`internal-layout${collapsed ? ' sidebar-collapsed' : ''}`}>
    <aside id="app-sidebar" className="sidebar">
      <div className="sidebar-header">
        <Logo compact />
        <button type="button" className="sidebar-toggle" onClick={toggle} aria-expanded={!collapsed} aria-controls="app-sidebar" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'}><Icon name="chevron-left" /></button>
      </div>
      <nav className="side-nav" aria-label="Menu principal">
        {visibleSections.map((section) => <div key={section.id} className="side-group" role="group" aria-labelledby={section.title ? `side-section-${section.id}` : undefined} aria-label={section.title ? undefined : 'Visão geral'}>
          {section.title && <span id={`side-section-${section.id}`} className="side-section">{section.title}</span>}
          {section.items.map((item) => <SideLink key={item.to} to={item.to} label={item.label} icon={item.icon} active={isActive(item.to)} collapsed={collapsed}>
            {item.to === '/tasks' && unassignedTaskCount > 0 && <i className="task-alert-badge">{unassignedTaskCount}</i>}
          </SideLink>)}
        </div>)}
      </nav>
      <div className="sidebar-footer"><button type="button" className="side-logout" onClick={() => void onLogout()} aria-label="Sair" title={collapsed ? 'Sair' : undefined}><Icon name="logout" /><span>Sair</span></button></div>
    </aside>
    <div className="internal-content">
      <header className="topbar"><div className="breadcrumb"><Link to="/">Início</Link><span>/</span><strong>{breadcrumbLabel}</strong></div><div className="topbar-user"><Avatar name={user?.name ?? 'Usuário'} /><div><strong>{user?.name ?? 'Usuário'}</strong><small>{roleLabel}</small></div></div></header>
      {children}
    </div>
  </div>
}
