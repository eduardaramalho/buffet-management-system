import { useState, type FormEvent } from 'react'
import { createCollaborator, setCollaboratorActive, updateCollaborator } from '../api/collaboratorsApi'
import { getApiErrorMessage } from '../api/apiError'
import { Button } from './Button'
import { Notice } from './Notice'
import type { Collaborator } from '../types/collaborator'

type CollaboratorFormProps = { collaborator?: Collaborator; onClose: () => void; onCreated: (collaborator: Collaborator) => void; onUpdated: (collaborator: Collaborator) => void }
export function CollaboratorForm({ collaborator, onClose, onCreated, onUpdated }: CollaboratorFormProps) {
  const [name, setName] = useState(collaborator?.name ?? '')
  const [phone, setPhone] = useState(collaborator?.phone ?? '')
  const [position, setPosition] = useState(collaborator?.position ?? '')
  const [active, setActive] = useState(collaborator ? collaborator.status === 'ATIVO' : true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault(); setError('')
    if (!name.trim()) return setError('Informe o nome do colaborador.')
    if (!position.trim()) return setError('Informe a função do colaborador.')
    setLoading(true)
    try {
      const input = { name: name.trim(), phone: phone.trim() || null, position: position.trim() }
      let saved = collaborator ? await updateCollaborator(collaborator.id, input) : await createCollaborator(input)
      if (collaborator && active !== (collaborator.status === 'ATIVO')) saved = await setCollaboratorActive(collaborator.id, active)
      collaborator ? onUpdated(saved) : onCreated(saved)
      onClose()
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível salvar o colaborador')) } finally { setLoading(false) }
  }

  return <aside className="user-form-panel" role="dialog" aria-modal="true" aria-labelledby="collaborator-form-title"><div className="form-wrap"><button type="button" className="link-button" onClick={onClose}>Voltar</button><h2 id="collaborator-form-title">{collaborator ? 'Editar colaborador' : 'Novo colaborador'}</h2><form onSubmit={submit}><label>Nome<input aria-label="Nome" value={name} onChange={(event) => setName(event.target.value)} /></label><label>Telefone<input aria-label="Telefone" value={phone ?? ''} onChange={(event) => setPhone(event.target.value)} /></label><label>Função<input aria-label="Função" value={position} onChange={(event) => setPosition(event.target.value)} /></label>{collaborator && <label><input type="checkbox" aria-label="Colaborador ativo" checked={active} onChange={(event) => setActive(event.target.checked)} /> Colaborador ativo</label>}{error && <Notice message={error} error />}<div className="form-actions"><Button type="button" className="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" className="primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button></div></form></div></aside>
}
