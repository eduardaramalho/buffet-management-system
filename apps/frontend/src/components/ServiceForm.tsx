import { useState } from 'react'
import { createService, updateService } from '../api/servicesApi'
import { getApiErrorMessage } from '../api/apiError'
import { useToast } from '../contexts/toast'
import { useFormValidation } from '../hooks/useFormValidation'
import { SERVICE_NAME_MAX, serviceFormSchema } from '../validation/serviceSchema'
import { Icon } from './Icon'
import { FormModal } from './form/FormModal'
import { TextField } from './form/TextField'
import type { Service } from '../types/event'

type ServiceFormProps = { service?: Service; onClose: () => void; onSaved: (service: Service) => void }

export function ServiceForm({ service, onClose, onSaved }: ServiceFormProps) {
  const toast = useToast()
  const [name, setName] = useState(service?.name ?? '')
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const validation = useFormValidation(serviceFormSchema, { name })

  const submit = async () => {
    setApiError('')
    const data = validation.submit()
    if (!data) return
    setSubmitting(true)
    try {
      // Uniqueness (409) and the protection of "Outro" are enforced by the API; its message is shown as is.
      const saved = service ? await updateService(service.id, data.name) : await createService(data.name)
      toast.success(service ? 'Serviço atualizado.' : 'Serviço criado.')
      onSaved(saved)
      onClose()
    } catch (cause) { setApiError(getApiErrorMessage(cause, 'Não foi possível salvar o serviço')) } finally { setSubmitting(false) }
  }

  return <FormModal title={service ? 'Editar serviço' : 'Novo serviço'} subtitle="Item do catálogo que pode ser contratado em um evento." icon={<Icon name="tag" />}
    onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel="Salvar serviço" error={apiError} invalidAttempt={validation.invalidAttempt}>
    {service?.isCustom && <p className="fm-callout"><Icon name="alert" />Serviço genérico: ao contratá-lo, o evento informa um rótulo livre (por exemplo, "Fotógrafo"). Ele pode ser renomeado, mas não excluído.</p>}
    <TextField label="Nome do serviço" required value={name} maxLength={SERVICE_NAME_MAX} aside={`${name.length}/${SERVICE_NAME_MAX}`}
      hint="O nome precisa ser único no catálogo." error={validation.errorFor('name')}
      onChange={(event) => setName(event.target.value)} onBlur={(event) => validation.touch('name', event)} />
  </FormModal>
}
