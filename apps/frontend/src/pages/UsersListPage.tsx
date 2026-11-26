import { useState } from 'react'
import { listUsers, setUserActive } from '../api/usersApi'
import { LoadBoundary } from '../components/LoadBoundary'
import { Notice } from '../components/Notice'
import { Pagination } from '../components/Pagination'
import { Table } from '../components/Table'
import { UserForm } from '../components/UserForm'
import { UserDetails } from '../components/UserDetails'
import { ResetPasswordDialog } from '../components/ResetPasswordDialog'
import { useAuth } from '../contexts/useAuth'
import { useInitialLoad } from '../hooks/useInitialLoad'
import { Avatar } from '../components/Avatar'
import { Badge } from '../components/Badge'
import { Icon } from '../components/Icon'
import { StatCard } from '../components/StatCard'
import type { User } from '../types'
import { usePageTitle } from '../hooks/usePageTitle'

const PAGE_SIZE = 10
const PROTECTED_ADMIN_TITLE = 'Usuários administradores não podem ser editados pela interface'

function roleTone(administrator: boolean, roleName: string) {
  if (administrator) return 'admin'
  return roleName.toLowerCase().includes('editor') ? 'editor' : 'viewer'
}

function statusActionTitle(user: User, administrator: boolean, own: boolean) {
  if (administrator) return PROTECTED_ADMIN_TITLE
  if (own) return 'Você não pode desativar a própria conta'
  return user.isActive ? 'Desativar usuário' : 'Ativar usuário'
}

function resetPasswordTitle(administrator: boolean, own: boolean) {
  if (administrator) return 'A senha de administradores não pode ser redefinida pela interface'
  return own ? 'Você não pode redefinir a própria senha por aqui' : 'Redefinir senha'
}

type UserRowProps = Readonly<{
  user: User
  administrator: boolean
  own: boolean
  canResetPassword: boolean
  onView: (user: User) => void
  onEdit: (user: User) => void
  onToggleStatus: (user: User) => void
  onResetPassword: (user: User) => void
}>

function UserRow({ user, administrator, own, canResetPassword, onView, onEdit, onToggleStatus, onResetPassword }: UserRowProps) {
  const roleName = user.roles.map(({ role }) => role.name).join(', ')
  return <tr>
    <td><div className="user-cell"><Avatar name={user.name} /><strong>{user.name}</strong></div></td>
    <td>{user.email}</td>
    <td>—</td>
    <td><Badge tone={roleTone(administrator, roleName)}>{roleName || 'Sem papel'}</Badge></td>
    <td><Badge tone={user.isActive ? 'active' : 'inactive'}>{user.isActive ? 'Ativo' : 'Inativo'}</Badge></td>
    <td><div className="row-actions">
      <button title="Visualizar usuário" aria-label={`Visualizar ${user.name}`} onClick={() => onView(user)}><Icon name="eye" /></button>
      <button title={administrator ? PROTECTED_ADMIN_TITLE : 'Editar usuário'} aria-label={`Editar ${user.name}`} disabled={administrator} onClick={() => onEdit(user)}><Icon name="pencil" /></button>
      <button title={statusActionTitle(user, administrator, own)} aria-label={`${user.isActive ? 'Desativar' : 'Ativar'} ${user.name}`} disabled={administrator || own} onClick={() => onToggleStatus(user)}><Icon name="power" /></button>
      {canResetPassword && <button title={resetPasswordTitle(administrator, own)} aria-label={`Redefinir senha de ${user.name}`} disabled={administrator || own} onClick={() => onResetPassword(user)}><Icon name="key" /></button>}
    </div></td>
  </tr>
}

export function UsersListPage() {
  usePageTitle('Usuários')
  const { user: actor } = useAuth()
  const canResetPassword = Boolean(actor?.roles?.some((role) => role.permissions.includes('users:reset-password')))
  const canCreate = Boolean(actor?.roles?.some((role) => role.permissions.includes('users:create')))
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User>()
  const [viewingUser, setViewingUser] = useState<User>()
  const [resettingUser, setResettingUser] = useState<User>()

  const load = async (value = '') => {
    try { setUsers(await listUsers(value)); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao carregar usuários') }
  }
  const initialLoad = useInitialLoad(() => listUsers(''), { onData: setUsers, errorMessage: 'Erro ao carregar usuários' })

  const isAdmin = (user: User) => user.roles.some(({ role }) => role.isProtected)
  // ADR 0018: ninguém se desativa nem redefine a própria senha por aqui (o backend também recusa com 403).
  const isOwnAccount = (user: User) => user.id === actor?.id
  const activeUsers = users.filter((user) => user.isActive).length
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE))
  const visibleUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const addUser = (user: User) => { setUsers((current) => [user, ...current]); setPage(1) }
  const replaceUser = (updated: User) => setUsers((current) => current.map((user) => user.id === updated.id ? updated : user))
  const changeStatus = async (user: User) => {
    if (user.isActive && !window.confirm(`Desativar ${user.name}?`)) return
    try { replaceUser(await setUserActive(user.id, !user.isActive)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao alterar status') }
  }

  return <main className="app-shell">
    <header><div><span className="eyebrow">PAINEL OPERACIONAL</span><h1>Usuários</h1></div>{canCreate && <button className="secondary" onClick={() => { setEditingUser(undefined); setFormOpen(true) }}>Novo usuário</button>}</header>
    <LoadBoundary status={initialLoad.status} error={initialLoad.error} onRetry={initialLoad.retry} label="Carregando usuários...">
    <section className="summary"><StatCard icon={<Icon name="users" />} value={users.length} label="Total de usuários" tone="blue" /><StatCard icon={<Icon name="check" />} value={activeUsers} label="Usuários ativos" tone="green" /><StatCard icon={<Icon name="x" />} value={users.length - activeUsers} label="Inativos" tone="gold" /><StatCard icon={<Icon name="shield" />} value={users.filter(isAdmin).length} label="Administradores" tone="purple" /></section>
    <section className="content-head"><input className="search" placeholder="Buscar por nome, e-mail ou cargo..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); void load(event.target.value) }} /><select aria-label="Todos os perfis"><option>Todos os perfis</option></select><select aria-label="Status"><option>Status</option></select><button className="secondary">Filtros</button></section>
    {error && <Notice message={error} error />}
    <Table headers={['Usuário', 'E-mail', 'Cargo', 'Perfil', 'Status', 'Ações']}>
      {visibleUsers.map((user) => <UserRow key={user.id} user={user} administrator={isAdmin(user)} own={isOwnAccount(user)} canResetPassword={canResetPassword} onView={setViewingUser} onEdit={(target) => { setEditingUser(target); setFormOpen(true) }} onToggleStatus={(target) => void changeStatus(target)} onResetPassword={setResettingUser} />)}
    </Table>
    {users.length === 0 && <div className="empty">Nenhum usuário encontrado.</div>}
    <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={setPage} />
    </LoadBoundary>
    {formOpen && <UserForm user={editingUser} isOwnAccount={editingUser ? isOwnAccount(editingUser) : false} onClose={() => { setFormOpen(false); setEditingUser(undefined) }} onCreated={addUser} onUpdated={(updated) => { replaceUser(updated); setFormOpen(false); setEditingUser(undefined) }} />}
    {viewingUser && <UserDetails user={viewingUser} onClose={() => setViewingUser(undefined)} />}
    {resettingUser && <ResetPasswordDialog user={resettingUser} onClose={() => setResettingUser(undefined)} />}
  </main>
}
