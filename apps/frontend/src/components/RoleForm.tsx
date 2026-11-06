import { useState } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { createRole, updateRole } from '../api/rolesApi'
import { useToast } from '../contexts/toast'
import { useFormValidation } from '../hooks/useFormValidation'
import { ROLE_DESCRIPTION_MAX, roleFormSchema } from '../validation/roleSchema'
import { Icon } from './Icon'
import { FormModal } from './form/FormModal'
import { TextAreaField, TextField } from './form/TextField'
import type { Role } from '../types'

type RoleFormProps = { role?: Role; onClose: () => void; onSaved: (role: Role) => void }

export function RoleForm({ role, onClose, onSaved }: RoleFormProps) {
  const toast = useToast()
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const validation = useFormValidation(roleFormSchema, { name, description })

  const submit = async () => {
    setApiError('')
    const data = validation.submit()
    if (!data) return
    setSubmitting(true)
    try {
      const saved = role ? await updateRole(role.id, data) : await createRole(data)
      toast.success(role ? 'Papel atualizado.' : 'Papel criado.')
      onSaved(saved)
      onClose()
    } catch (cause) { setApiError(getApiErrorMessage(cause, 'Não foi possível salvar o papel')) } finally { setSubmitting(false) }
  }

  return <FormModal title={role ? 'Editar papel' : 'Novo papel'} subtitle="Agrupa permissões que serão atribuídas aos usuários." icon={<Icon name="shield" />}
    onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel="Salvar papel" error={apiError} invalidAttempt={validation.invalidAttempt}>
    <TextField label="Nome" required value={name} maxLength={50} placeholder="Ex.: Supervisor de salão" error={validation.errorFor('name')}
      onChange={(event) => setName(event.target.value)} onBlur={(event) => validation.touch('name', event.target)} />
    <TextAreaField label="Descrição" optional value={description} maxLength={ROLE_DESCRIPTION_MAX} aside={`${description.length}/${ROLE_DESCRIPTION_MAX}`}
      placeholder="O que este papel pode fazer" error={validation.errorFor('description')} onChange={(event) => setDescription(event.target.value)} onBlur={(event) => validation.touch('description', event.target)} />
  </FormModal>
}
