import { useState } from 'react'
import { listRoles } from '../api/rolesApi'
import { Icon } from '../components/Icon'
import { LoadBoundary } from '../components/LoadBoundary'
import { RoleForm } from '../components/RoleForm'
import { Table } from '../components/Table'
import { useAuth } from '../contexts/useAuth'
import { useInitialLoad } from '../hooks/useInitialLoad'
import type { Role } from '../types'
import { usePageTitle } from '../hooks/usePageTitle'

export function RolesListPage() {
  usePageTitle('Papéis e permissões')
  const { user } = useAuth()
  const can = (permission: string) => Boolean(user?.roles?.some((role) => role.permissions.includes(permission)))
  const [roles, setRoles] = useState<Role[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role>()

  const initialLoad = useInitialLoad(listRoles, { onData: setRoles, errorMessage: 'Não foi possível carregar os papéis' })

  const openForm = (role?: Role) => { setEditingRole(role); setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditingRole(undefined) }
  const saveRole = (saved: Role) => setRoles((current) => current.some((role) => role.id === saved.id)
    ? current.map((role) => (role.id === saved.id ? { ...role, ...saved } : role))
    : [...current, saved])

  return (
    <main className="app-shell page-fill">
      <header>
        <div>
          <span className="eyebrow">CONTROLE DE ACESSO</span>
          <h1>Papéis</h1>
        </div>
        {can('roles:create') && <button type="button" className="secondary" onClick={() => openForm()}>Novo papel</button>}
      </header>
      <LoadBoundary status={initialLoad.status} error={initialLoad.error} onRetry={initialLoad.retry} label="Carregando papéis...">
      <Table headers={['Nome', 'Descrição', 'Ações']}>
        {roles.map((role) => (
          <tr key={role.id}>
            <td><strong>{role.name}</strong></td>
            <td>{role.description}</td>
            <td><div className="row-actions">{can('roles:update') && <button type="button" title="Editar papel" aria-label={`Editar ${role.name}`} onClick={() => openForm(role)}><Icon name="pencil" /></button>}</div></td>
          </tr>
        ))}
      </Table>
      </LoadBoundary>
      {formOpen && <RoleForm role={editingRole} onClose={closeForm} onSaved={saveRole} />}
    </main>
  )
}
