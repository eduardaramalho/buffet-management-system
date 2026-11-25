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
function SideLink({ to, label, icon, active, collapsed, children }: SideLinkProps) {
  return <Link aria-label={label} title={collapsed ? label : undefined} to={to} className={`side-link${active ? ' active' : ''}`}><Icon name={icon} /><span>{label}</span>{children}</Link>
}

export function InternalLayout({ children, onLogout }: { children: ReactNode; onLogout: () => Promise<void> }) {
  const { user } = useAuth()
  const location = useLocation()
  const hasPermission = (permission: string) => user?.roles?.some((role) => role.permissions.includes(permission)) ?? false
  const roleLabel = user?.roles?.map((role) => role.name).join(', ') || 'Usuário'
  const breadcrumbLabel = Object.entries(breadcrumbLabels).find(([path]) => location.pathname.startsWith(path))?.[1] ?? (location.pathname === '/' ? 'Dashboard' : 'Administração')
  const [unassignedTaskCount, setUnassignedTaskCount] = useState(0)
  const { collapsed, toggle } = useSidebarCollapsed()
  const isActive = (path: string) => location.pathname.startsWith(path)

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
      <nav className="side-nav">
        {hasPermission('dashboard:view') && <SideLink to="/" label="Dashboard" icon="home" active={location.pathname === '/'} collapsed={collapsed} />}
        {hasPermission('reports:view') && <SideLink to="/reports" label="Relatórios" icon="chart" active={isActive('/reports')} collapsed={collapsed} />}
        <span className="side-section">OPERAÇÃO</span>
        {hasPermission('events:list') && <SideLink to="/events" label="Eventos" icon="calendar" active={isActive('/events')} collapsed={collapsed} />}
        {hasPermission('clients:list') && <SideLink to="/clients" label="Clientes" icon="contact" active={isActive('/clients')} collapsed={collapsed} />}
        {hasPermission('services:list') && <SideLink to="/services" label="Serviços" icon="tag" active={isActive('/services')} collapsed={collapsed} />}
        {canListTasks && <SideLink to="/tasks" label="Tarefas" icon="tasks" active={isActive('/tasks')} collapsed={collapsed}>{unassignedTaskCount > 0 && <i className="task-alert-badge">{unassignedTaskCount}</i>}</SideLink>}
        {hasPermission('teams:list') && <SideLink to="/teams" label="Equipes" icon="users" active={isActive('/teams')} collapsed={collapsed} />}
        {hasPermission('collaborators:manage') && <SideLink to="/collaborators" label="Colaboradores" icon="user" active={isActive('/collaborators')} collapsed={collapsed} />}
        <span className="side-section">AUTOMAÇÃO</span>
        {hasPermission('rules:list') && <SideLink to="/rules" label="Regras" icon="bolt" active={isActive('/rules')} collapsed={collapsed} />}
        <span className="side-section">ADMINISTRAÇÃO</span>
        {hasPermission('users:list') && <SideLink to="/users" label="Usuários" icon="users" active={isActive('/users')} collapsed={collapsed} />}
        {hasPermission('roles:list') && <SideLink to="/roles" label="Papéis e permissões" icon="shield" active={isActive('/roles')} collapsed={collapsed} />}
      </nav>
      <div className="sidebar-footer"><Avatar name={user?.name ?? 'Usuário'} small /><div><strong>{user?.name ?? 'Usuário'}</strong><small>{roleLabel}</small></div><button type="button" onClick={() => void onLogout()} aria-label="Sair" title="Sair"><Icon name="logout" /></button></div>
    </aside>
    <div className="internal-content">
      <header className="topbar"><div className="breadcrumb"><Link to="/">Início</Link><span>/</span><strong>{breadcrumbLabel}</strong></div><div className="topbar-user"><Avatar name={user?.name ?? 'Usuário'} /><div><strong>{user?.name ?? 'Usuário'}</strong><small>{roleLabel}</small></div></div></header>
      {children}
    </div>
  </div>
}
