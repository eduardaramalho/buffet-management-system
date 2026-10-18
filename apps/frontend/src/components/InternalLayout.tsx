import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { listTasks } from '../api/tasksApi'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Logo } from './Logo'

const breadcrumbLabels: Record<string, string> = {
  '/rules': 'Regras',
  '/users': 'Usuários',
  '/collaborators': 'Colaboradores',
  '/roles': 'Papéis e permissões',
}

export function InternalLayout({ children, onLogout }: { children: ReactNode; onLogout: () => Promise<void> }) {
  const { user } = useAuth()
  const location = useLocation()
  const hasPermission = (permission: string) => user?.roles?.some((role) => role.permissions.includes(permission)) ?? false
  const roleLabel = user?.roles?.map((role) => role.name).join(', ') || 'Usuário'
  const breadcrumbLabel = Object.entries(breadcrumbLabels).find(([path]) => location.pathname.startsWith(path))?.[1] ?? (location.pathname === '/' ? 'Dashboard' : 'Administração')
  const [unassignedTaskCount, setUnassignedTaskCount] = useState(0)

  useEffect(() => {
    if (!hasPermission('tasks:list')) { setUnassignedTaskCount(0); return }
    listTasks().then((tasks) => setUnassignedTaskCount(tasks.filter((task) => !task.assignedTeamId && task.status !== 'CONCLUIDA' && task.status !== 'CANCELADA').length)).catch(() => setUnassignedTaskCount(0))
  }, [user])

  return <div className="internal-layout">
    <aside className="sidebar">
      <Logo compact />
      <nav className="side-nav">
        {hasPermission('dashboard:view') && <Link aria-label="Dashboard" to="/" className={`side-link${location.pathname === '/' ? ' active' : ''}`}><Icon name="home" /><span>Dashboard</span></Link>}
        <span className="side-section">OPERAÇÃO</span>
        {hasPermission('events:list') && <Link aria-label="Eventos" to="/events" className={`side-link${location.pathname.startsWith('/events') ? ' active' : ''}`}><Icon name="calendar" /><span>Eventos</span></Link>}
        {hasPermission('tasks:list') && <Link aria-label="Tarefas" to="/tasks" className={`side-link${location.pathname.startsWith('/tasks') ? ' active' : ''}`}><Icon name="tasks" /><span>Tarefas</span>{unassignedTaskCount > 0 && <i className="task-alert-badge">{unassignedTaskCount}</i>}</Link>}
        {hasPermission('teams:list') && <Link aria-label="Equipes" to="/teams" className={`side-link${location.pathname.startsWith('/teams') ? ' active' : ''}`}><Icon name="users" /><span>Equipes</span></Link>}
        {hasPermission('collaborators:manage') && <Link aria-label="Colaboradores" to="/collaborators" className={`side-link${location.pathname.startsWith('/collaborators') ? ' active' : ''}`}><Icon name="user" /><span>Colaboradores</span></Link>}
        <span className="side-section">AUTOMAÇÃO</span>
        {hasPermission('rules:list') && <Link aria-label="Regras" to="/rules" className={`side-link${location.pathname.startsWith('/rules') ? ' active' : ''}`}><Icon name="bolt" /><span>Regras</span></Link>}
        <span className="side-section">ADMINISTRAÇÃO</span>
        {hasPermission('users:list') && <Link aria-label="Usuários" to="/users" className={`side-link${location.pathname.startsWith('/users') ? ' active' : ''}`}><Icon name="users" /><span>Usuários</span></Link>}
        {hasPermission('roles:list') && <Link aria-label="Papéis e permissões" to="/roles" className={`side-link${location.pathname.startsWith('/roles') ? ' active' : ''}`}><Icon name="shield" /><span>Papéis e permissões</span></Link>}
      </nav>
      <div className="sidebar-footer"><Avatar name={user?.name ?? 'Usuário'} small /><div><strong>{user?.name ?? 'Usuário'}</strong><small>{roleLabel}</small></div><button type="button" onClick={() => void onLogout()} aria-label="Sair" title="Sair"><Icon name="logout" /></button></div>
    </aside>
    <div className="internal-content">
      <header className="topbar"><div className="breadcrumb"><Link to="/">Início</Link><span>/</span><strong>{breadcrumbLabel}</strong></div><div className="topbar-user"><Avatar name={user?.name ?? 'Usuário'} /><div><strong>{user?.name ?? 'Usuário'}</strong><small>{roleLabel}</small></div></div></header>
      {children}
    </div>
  </div>
}
