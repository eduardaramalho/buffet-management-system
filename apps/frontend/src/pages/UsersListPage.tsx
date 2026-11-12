import { useEffect, useState } from 'react'
import { listUsers, setUserActive } from '../api/usersApi'
import { Notice } from '../components/Notice'
import { Pagination } from '../components/Pagination'
import { Table } from '../components/Table'
import { UserForm } from '../components/UserForm'
import { UserDetails } from '../components/UserDetails'
import { ResetPasswordDialog } from '../components/ResetPasswordDialog'
import { useAuth } from '../contexts/useAuth'
import { Avatar } from '../components/Avatar'
import { Badge } from '../components/Badge'
import { Icon } from '../components/Icon'
import { StatCard } from '../components/StatCard'
import type { User } from '../types'

const PAGE_SIZE = 10
export function UsersListPage() {
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

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

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
    <section className="summary"><StatCard icon={<Icon name="users" />} value={users.length} label="Total de usuários" tone="blue" /><StatCard icon={<Icon name="check" />} value={activeUsers} label="Usuários ativos" tone="green" /><StatCard icon={<Icon name="x" />} value={users.length - activeUsers} label="Inativos" tone="gold" /><StatCard icon={<Icon name="shield" />} value={users.filter(isAdmin).length} label="Administradores" tone="purple" /></section>
    <section className="content-head"><input className="search" placeholder="Buscar por nome, e-mail ou cargo..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); void load(event.target.value) }} /><select aria-label="Todos os perfis"><option>Todos os perfis</option></select><select aria-label="Status"><option>Status</option></select><button className="secondary">Filtros</button></section>
    {error && <Notice message={error} error />}
    <Table headers={['Usuário', 'E-mail', 'Cargo', 'Perfil', 'Status', 'Ações']}>
      {visibleUsers.map((user) => { const administrator = isAdmin(user); const own = isOwnAccount(user); const roleName = user.roles.map(({ role }) => role.name).join(', '); const tone = administrator ? 'admin' : roleName.toLowerCase().includes('editor') ? 'editor' : 'viewer'; return <tr key={user.id}><td><div className="user-cell"><Avatar name={user.name} /><strong>{user.name}</strong></div></td><td>{user.email}</td><td>—</td><td><Badge tone={tone}>{roleName || 'Sem papel'}</Badge></td><td><Badge tone={user.isActive ? 'active' : 'inactive'}>{user.isActive ? 'Ativo' : 'Inativo'}</Badge></td><td><div className="row-actions"><button title="Visualizar usuário" aria-label={`Visualizar ${user.name}`} onClick={() => setViewingUser(user)}><Icon name="eye" /></button><button title={administrator ? 'Usuários administradores não podem ser editados pela interface' : 'Editar usuário'} aria-label={`Editar ${user.name}`} disabled={administrator} onClick={() => { setEditingUser(user); setFormOpen(true) }}><Icon name="pencil" /></button><button title={administrator ? 'Usuários administradores não podem ser editados pela interface' : own ? 'Você não pode desativar a própria conta' : user.isActive ? 'Desativar usuário' : 'Ativar usuário'} aria-label={`${user.isActive ? 'Desativar' : 'Ativar'} ${user.name}`} disabled={administrator || own} onClick={() => void changeStatus(user)}><Icon name="power" /></button>{canResetPassword && <button title={administrator ? 'A senha de administradores não pode ser redefinida pela interface' : own ? 'Você não pode redefinir a própria senha por aqui' : 'Redefinir senha'} aria-label={`Redefinir senha de ${user.name}`} disabled={administrator || own} onClick={() => setResettingUser(user)}><Icon name="key" /></button>}</div></td></tr> })}
    </Table>
    {users.length === 0 && <div className="empty">Nenhum usuário encontrado.</div>}
    <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={setPage} />
    {formOpen && <UserForm user={editingUser} isOwnAccount={editingUser ? isOwnAccount(editingUser) : false} onClose={() => { setFormOpen(false); setEditingUser(undefined) }} onCreated={addUser} onUpdated={(updated) => { replaceUser(updated); setFormOpen(false); setEditingUser(undefined) }} />}
    {viewingUser && <UserDetails user={viewingUser} onClose={() => setViewingUser(undefined)} />}
    {resettingUser && <ResetPasswordDialog user={resettingUser} onClose={() => setResettingUser(undefined)} />}
  </main>
}
