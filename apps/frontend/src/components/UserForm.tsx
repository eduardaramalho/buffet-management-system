import { useEffect, useState, type FormEvent } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { createUser, setUserActive, updateUser } from '../api/usersApi'
import { listRoles } from '../api/rolesApi'
import { Button } from './Button'
import { FormField } from './FormField'
import { Notice } from './Notice'
import type { Role, User } from '../types'

type UserFormProps = { user?: User; onClose: () => void; onCreated: (user: User) => void; onUpdated: (user: User) => void }

export function UserForm({ user, onClose, onCreated, onUpdated }: UserFormProps) {
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [roleId, setRoleId] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>(user?.isActive === false ? 'inactive' : 'active')
  const [roles, setRoles] = useState<Role[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { void listRoles().then(setRoles).catch((cause) => setError(getApiErrorMessage(cause, 'Não foi possível criar o usuário'))) }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (user) {
        const updatedUser = await updateUser(user.id, { name, email })
        const finalUser = status === 'inactive' && updatedUser.isActive ? await setUserActive(updatedUser.id, false) : updatedUser
        onUpdated(finalUser)
      } else {
        const createdUser = await createUser({ name, email, password, roleId })
        const finalUser = status === 'inactive' ? await setUserActive(createdUser.id, false) : createdUser
        onCreated(finalUser)
      }
      onClose()
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível criar o usuário')) } finally { setLoading(false) }
  }

  return <aside className="user-form-panel" role="dialog" aria-modal="true" aria-labelledby="user-form-title"><div className="form-wrap"><button type="button" className="link-button" onClick={onClose}>Fechar</button><h2 id="user-form-title">{user ? 'Editar usuário' : 'Novo usuário'}</h2><p className="muted">{user ? 'Atualize os dados do usuário.' : 'Cadastre um novo integrante da operação.'}</p><form onSubmit={submit}><FormField label="Nome" value={name} onChange={(event) => setName(event.target.value)} required /><FormField label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />{!user && <><label>Papel<select aria-label="Papel" value={roleId} onChange={(event) => setRoleId(event.target.value)} required><option value="">Selecione um papel</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><FormField label="Senha inicial" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></>}<label>Status<select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>{error && <Notice message={error} error />}<Button disabled={loading}>{loading ? 'Salvando...' : user ? 'Salvar alterações' : 'Criar usuário'}</Button></form></div></aside>
}