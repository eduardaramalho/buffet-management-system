import { useEffect, useState, type FormEvent } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { createRule, updateRule } from '../api/rulesApi'
import { listServices } from '../api/servicesApi'
import { Button } from './Button'
import { Notice } from './Notice'
import { EVENT_TYPES, type EventType, type Service } from '../types/event'
import { TEAM_SPECIALTIES, type TeamSpecialty } from '../types/team'
import type { Rule, RuleResourceRequirementInput } from '../types/rule'

type RuleFormProps = { rule?: Rule; onClose: () => void; onCreated: (rule: Rule) => void; onUpdated: (rule: Rule) => void }
const eventTypeLabels: Record<EventType, string> = { CASAMENTO: 'Casamento', ANIVERSARIO: 'Aniversário', FORMATURA: 'Formatura', CORPORATIVO: 'Corporativo', CONFRATERNIZACAO: 'Confraternização', BATIZADO: 'Batizado', OUTRO: 'Outro' }
const specialtyLabels: Record<TeamSpecialty, string> = { COZINHA: 'Cozinha', SALAO: 'Salão', BAR: 'Bar', DECORACAO: 'Decoração', LIMPEZA: 'Limpeza', CERIMONIAL: 'Cerimonial', OUTRO: 'Outro' }
export function RuleForm({ rule, onClose, onCreated, onUpdated }: RuleFormProps) {
  const [name, setName] = useState(rule?.name ?? '')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [serviceTypes, setServiceTypes] = useState<EventType[]>(rule?.conditionServiceTypeIn ?? [])
  const [minGuests, setMinGuests] = useState(rule?.conditionMinGuests != null ? String(rule.conditionMinGuests) : '')
  const [maxGuests, setMaxGuests] = useState(rule?.conditionMaxGuests != null ? String(rule.conditionMaxGuests) : '')
  const [requiredServiceIds, setRequiredServiceIds] = useState<string[]>(rule?.conditionRequiredServiceIds ?? [])
  const [services, setServices] = useState<Service[]>([])
  const [requirements, setRequirements] = useState<RuleResourceRequirementInput[]>(
    rule?.resourceRequirements.map((item) => ({ specialty: item.specialty, minQuantity: item.minQuantity })) ?? [],
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { void listServices().then(setServices).catch((cause) => setError(getApiErrorMessage(cause, 'Não foi possível salvar a regra'))) }, [])

  const toggleServiceType = (type: EventType) => setServiceTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])
  const toggleRequiredService = (serviceId: string) => setRequiredServiceIds((current) => current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId])
  const addRequirement = () => setRequirements((current) => [...current, { specialty: TEAM_SPECIALTIES[0], minQuantity: 1 }])
  const updateRequirement = (index: number, patch: Partial<RuleResourceRequirementInput>) => setRequirements((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  const removeRequirement = (index: number) => setRequirements((current) => current.filter((_, itemIndex) => itemIndex !== index))

  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault(); setError('')
    if (!name.trim()) return setError('Informe o nome da regra.')
    if (minGuests && maxGuests && Number(minGuests) > Number(maxGuests)) return setError('O mínimo de convidados não pode ser maior que o máximo.')
    if (requirements.some((requirement) => requirement.minQuantity < 1)) return setError('A quantidade mínima de cada especialidade deve ser ao menos 1.')
    setLoading(true)
    try {
      const input = {
        name: name.trim(),
        description: description.trim() || null,
        conditionServiceTypeIn: serviceTypes.length ? serviceTypes : null,
        conditionMinGuests: minGuests ? Number(minGuests) : null,
        conditionMaxGuests: maxGuests ? Number(maxGuests) : null,
        conditionRequiredServiceIds: requiredServiceIds.length ? requiredServiceIds : null,
        resourceRequirements: requirements,
      }
      const saved = rule ? await updateRule(rule.id, input) : await createRule(input)
      rule ? onUpdated(saved) : onCreated(saved)
      onClose()
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível salvar a regra')) } finally { setLoading(false) }
  }

  return <aside className="user-form-panel" role="dialog" aria-modal="true" aria-labelledby="rule-form-title"><div className="form-wrap">
    <button type="button" className="link-button" onClick={onClose}>Voltar</button>
    <h2 id="rule-form-title">{rule ? 'Editar regra' : 'Nova regra'}</h2>
    <form onSubmit={submit}>
      <label>Nome da regra<input aria-label="Nome da regra" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Descrição<textarea aria-label="Descrição" value={description ?? ''} onChange={(event) => setDescription(event.target.value)} /></label>

      <section><h3>Condições</h3>
        <p className="muted">Deixe uma condição em branco para que ela combine com qualquer evento.</p>
        <div className="service-checks">{EVENT_TYPES.map((type) => <label key={type}><input type="checkbox" aria-label={eventTypeLabels[type]} checked={serviceTypes.includes(type)} onChange={() => toggleServiceType(type)} /> {eventTypeLabels[type]}</label>)}</div>
        <label>Mínimo de convidados<input aria-label="Mínimo de convidados" type="number" min="0" value={minGuests} onChange={(event) => setMinGuests(event.target.value)} /></label>
        <label>Máximo de convidados<input aria-label="Máximo de convidados" type="number" min="0" value={maxGuests} onChange={(event) => setMaxGuests(event.target.value)} /></label>
        <h4>Serviços obrigatórios</h4>
        {services.length === 0 ? <p className="empty">Nenhum serviço cadastrado. Cadastre serviços para usá-los como condição.</p> : <div className="service-checks">{services.map((service) => <label key={service.id}><input type="checkbox" aria-label={service.name} checked={requiredServiceIds.includes(service.id)} onChange={() => toggleRequiredService(service.id)} /> {service.name}</label>)}</div>}
      </section>

      <section><h3>Recursos exigidos</h3>
        {requirements.map((requirement, index) => <div key={index} className="rule-requirement-row">
          <label>Especialidade<select aria-label={`Especialidade ${index + 1}`} value={requirement.specialty} onChange={(event) => updateRequirement(index, { specialty: event.target.value as TeamSpecialty })}>{TEAM_SPECIALTIES.map((specialty) => <option key={specialty} value={specialty}>{specialtyLabels[specialty]}</option>)}</select></label>
          <label>Quantidade mínima<input aria-label={`Quantidade mínima ${index + 1}`} type="number" min="1" value={requirement.minQuantity} onChange={(event) => updateRequirement(index, { minQuantity: Number(event.target.value) })} /></label>
          <button type="button" className="link-button" aria-label={`Remover recurso ${index + 1}`} onClick={() => removeRequirement(index)}>Remover</button>
        </div>)}
        <button type="button" className="link-button" onClick={addRequirement}>+ Adicionar recurso</button>
      </section>

      {error && <Notice message={error} error />}
      <div className="form-actions">
        <Button type="button" className="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" className="primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
      </div>
    </form>
  </div></aside>
}
