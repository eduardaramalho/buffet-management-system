import { useState, type SubmitEvent } from 'react'
import { createService, updateService } from '../api/servicesApi'
import { getApiErrorMessage } from '../api/apiError'
import { Button } from './Button'
import { Notice } from './Notice'
import type { Service } from '../types/event'

type ServiceFormProps = { service?: Service; onClose: () => void; onSaved: (service: Service) => void }

export function ServiceForm({ service, onClose, onSaved }: ServiceFormProps) {
  const [name, setName] = useState(service?.name ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const title = service ? 'Editar serviço' : 'Novo serviço'

  const submit = async (formEvent: SubmitEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Informe o nome do serviço.')
      return
    }
    setError('')
    setLoading(true)
    try {
      // Uniqueness (409) and the protection of "Outro" are enforced by the API; its message is shown as is.
      onSaved(service ? await updateService(service.id, trimmed) : await createService(trimmed))
      onClose()
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível salvar o serviço')) } finally { setLoading(false) }
  }

  return <aside className="user-form-panel" role="dialog" aria-modal="true" aria-labelledby="service-form-title"><div className="form-wrap">
    <button type="button" className="link-button" onClick={onClose}>Voltar</button>
    <h2 id="service-form-title">{title}</h2>
    {service?.isCustom && <p className="muted">Serviço genérico: ao contratá-lo, o evento informa um rótulo livre (por exemplo, "Fotógrafo"). Ele pode ser renomeado, mas não excluído.</p>}
    <form onSubmit={(formEvent) => void submit(formEvent)} noValidate>
      <label>Nome do serviço<input aria-label="Nome do serviço" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} /></label>
      {error && <Notice message={error} error />}
      <div className="form-actions"><Button type="button" className="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" className="primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button></div>
    </form>
  </div></aside>
}
