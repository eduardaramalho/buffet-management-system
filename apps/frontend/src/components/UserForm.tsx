import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { createUser, setUserActive, updateUser } from '../api/usersApi'
import { listRoles } from '../api/rolesApi'
import { useToast } from '../contexts/toast'
import { useFormValidation } from '../hooks/useFormValidation'
import { PASSWORD_MIN_LENGTH, userCreateFormSchema, userUpdateFormSchema } from '../validation/userSchema'
import { Icon } from './Icon'
import { ChoiceCard } from './form/ChoiceCard'
import { FieldGroup } from './form/FieldGroup'
import { FormModal } from './form/FormModal'
import { PasswordField } from './form/PasswordField'
import { Switch } from './form/Switch'
import { TextField } from './form/TextField'
import type { Role, User } from '../types'

type UserFormProps = { user?: User; onClose: () => void; onCreated: (user: User) => void; onUpdated: (user: User) => void }

/** Cadastro e edição de usuário. Na edição não há papel nem senha (ADR 0012): a senha só muda pelo reset do administrador. */
export function UserForm({ user, onClose, onCreated, onUpdated }: UserFormProps) {
  const toast = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [roleId, setRoleId] = useState('')
  const [password, setPassword] = useState('')
  const [active, setActive] = useState(user?.isActive !== false)
  const [roles, setRoles] = useState<Role[]>([])
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const createValidation = useFormValidation(userCreateFormSchema, { name, email, password, roleId })
  const updateValidation = useFormValidation(userUpdateFormSchema, { name, email })
  const validation = user ? updateValidation : createValidation

  useEffect(() => {
    if (user) return
    void listRoles().then(setRoles).catch((cause) => setApiError(getApiErrorMessage(cause, 'Não foi possível carregar os papéis')))
  }, [user])

  const save = async () => {
    if (!user) return createUser({ name: name.trim(), email: email.trim(), password, roleId })
    const updated = await updateUser(user.id, { name: name.trim(), email: email.trim() })
    return active !== updated.isActive ? setUserActive(user.id, active) : updated
  }

  const submit = async () => {
    setApiError('')
    if (!validation.submit()) return
    setSubmitting(true)
    try {
      const saved = await save()
      toast.success(user ? 'Usuário atualizado.' : 'Usuário criado.')
      if (user) onUpdated(saved)
      else onCreated(saved)
      onClose()
    } catch (cause) { setApiError(getApiErrorMessage(cause, 'Não foi possível salvar o usuário')) } finally { setSubmitting(false) }
  }

  return <FormModal title={user ? 'Editar usuário' : 'Novo usuário'} subtitle={user ? user.email : 'Quem acessa o sistema e com qual papel.'} icon={<Icon name="user" />}
    onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel={user ? 'Salvar alterações' : 'Criar usuário'} error={apiError} invalidAttempt={validation.invalidAttempt}>
    <div className="fm-row">
      <TextField label="Nome" required value={name} maxLength={150} autoComplete="off" error={validation.errorFor('name')}
        onChange={(event) => setName(event.target.value)} onBlur={(event) => validation.touch('name', event)} />
      <TextField label="E-mail" required type="email" value={email} maxLength={150} autoComplete="off" error={validation.errorFor('email')}
        onChange={(event) => setEmail(event.target.value)} onBlur={(event) => validation.touch('email', event)} />
    </div>
    {!user && <>
      <PasswordField label="Senha inicial" required className="fm-half" value={password} autoComplete="new-password" hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`}
        error={createValidation.errorFor('password')} onChange={(event) => setPassword(event.target.value)} onBlur={(event) => createValidation.touch('password', event)} />
      <FieldGroup label="Papel" required error={createValidation.errorFor('roleId')} hint="O usuário nasce ativo; ativar ou desativar fica só na edição.">
        <div className="fm-choices" role="radiogroup" aria-label="Papel">
          {roles.map((role) => <ChoiceCard key={role.id} type="radio" name="user-role" value={role.id} title={role.name} description={role.description ?? undefined}
            checked={roleId === role.id} onChange={() => setRoleId(role.id)} aria-invalid={createValidation.errorFor('roleId') ? true : undefined} />)}
        </div>
      </FieldGroup>
    </>}
    {user && <Switch label="Usuário ativo" description="Usuários inativos não conseguem entrar no sistema." checked={active} onChange={setActive} />}
  </FormModal>
}
