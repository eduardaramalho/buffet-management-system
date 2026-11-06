import { useEffect, useMemo, useState } from 'react'
import { createCollaborator, listCollaborators, setCollaboratorActive, updateCollaborator } from '../api/collaboratorsApi'
import { getApiErrorMessage } from '../api/apiError'
import { useToast } from '../contexts/toast'
import { useFormValidation } from '../hooks/useFormValidation'
import { initials } from '../utils/initials'
import { maskPhone } from '../utils/masks'
import { collaboratorFormSchema } from '../validation/collaboratorSchema'
import { Icon } from './Icon'
import { FormModal } from './form/FormModal'
import { MaskedField } from './form/MaskedField'
import { Switch } from './form/Switch'
import { TextField } from './form/TextField'
import type { Collaborator } from '../types/collaborator'

type CollaboratorFormProps = { collaborator?: Collaborator; onClose: () => void; onCreated: (collaborator: Collaborator) => void; onUpdated: (collaborator: Collaborator) => void }
const POSITION_SUGGESTIONS = 6

/** Cargos mais usados no cadastro, para padronizar a escrita (ex.: sempre "Garçom", e não "garcom"). */
const mostUsedPositions = (collaborators: Collaborator[]) => {
  const counts = new Map<string, number>()
  for (const { position } of collaborators) counts.set(position, (counts.get(position) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, POSITION_SUGGESTIONS).map(([position]) => position)
}

export function CollaboratorForm({ collaborator, onClose, onCreated, onUpdated }: CollaboratorFormProps) {
  const toast = useToast()
  const [name, setName] = useState(collaborator?.name ?? '')
  const [phone, setPhone] = useState(collaborator?.phone ? maskPhone(collaborator.phone) : '')
  const [position, setPosition] = useState(collaborator?.position ?? '')
  const [active, setActive] = useState(collaborator ? collaborator.status === 'ATIVO' : true)
  const [known, setKnown] = useState<Collaborator[]>([])
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const validation = useFormValidation(collaboratorFormSchema, { name, phone, position })

  // As sugestões são só uma ajuda: se a lista não carregar, o campo continua livre.
  useEffect(() => { void listCollaborators().then(setKnown).catch(() => setKnown([])) }, [])
  const suggestions = useMemo(() => mostUsedPositions(known).filter((item) => item !== position.trim()), [known, position])

  const submit = async () => {
    setApiError('')
    if (!validation.submit()) return
    setSubmitting(true)
    try {
      const input = { name: name.trim(), phone: phone.trim() || null, position: position.trim() }
      let saved = collaborator ? await updateCollaborator(collaborator.id, input) : await createCollaborator(input)
      if (collaborator && active !== (collaborator.status === 'ATIVO')) saved = await setCollaboratorActive(collaborator.id, active)
      toast.success(collaborator ? 'Colaborador atualizado.' : 'Colaborador cadastrado.')
      if (collaborator) onUpdated(saved)
      else onCreated(saved)
      onClose()
    } catch (cause) { setApiError(getApiErrorMessage(cause, 'Não foi possível salvar o colaborador')) } finally { setSubmitting(false) }
  }

  return <FormModal title={collaborator ? 'Editar colaborador' : 'Novo colaborador'} subtitle={collaborator ? collaborator.name : 'Pessoa da operação que pode compor equipes.'}
    icon={collaborator ? initials(collaborator.name) : <Icon name="user" />} roundIcon={Boolean(collaborator)}
    onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel={collaborator ? 'Salvar alterações' : 'Salvar colaborador'} error={apiError} invalidAttempt={validation.invalidAttempt}>
    <div className="fm-row">
      <TextField label="Nome" required value={name} maxLength={150} error={validation.errorFor('name')}
        onChange={(event) => setName(event.target.value)} onBlur={(event) => validation.touch('name', event)} />
      <TextField label="Cargo" required value={position} maxLength={100} placeholder="Ex.: Garçom" error={validation.errorFor('position')}
        hint="Aparece ao lado do nome na montagem das equipes." onChange={(event) => setPosition(event.target.value)} onBlur={(event) => validation.touch('position', event)} />
    </div>
    {suggestions.length > 0 && <div className="fm-chips" role="group" aria-label="Cargos já usados">
      {suggestions.map((item) => <button key={item} type="button" className="fm-chip-btn" aria-label={`Usar o cargo ${item}`} onClick={() => setPosition(item)}>{item}</button>)}
    </div>}
    <MaskedField label="Telefone" optional className="fm-half" value={phone} mask={maskPhone} placeholder="(47) 99999-9999" inputMode="tel"
      error={validation.errorFor('phone')} onValueChange={setPhone} onBlur={(event) => validation.touch('phone', event)} />
    {collaborator && <Switch label="Colaborador ativo" description="Inativos não aparecem na busca de membros." checked={active} onChange={setActive} />}
  </FormModal>
}
