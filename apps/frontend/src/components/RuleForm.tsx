import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { createRule, updateRule } from '../api/rulesApi'
import { listServices } from '../api/servicesApi'
import { useToast } from '../contexts/toast'
import { useFormValidation } from '../hooks/useFormValidation'
import { EVENT_TYPE_LABELS, TEAM_SPECIALTY_LABELS } from '../utils/labels'
import { maskInteger } from '../utils/masks'
import { hasErrorIn } from '../validation/fieldErrors'
import { toOptionalNumber } from '../validation/rules'
import { RULE_TASKS_MAX, ruleFormSchema } from '../validation/ruleSchema'
import { Icon } from './Icon'
import { ChoiceCard } from './form/ChoiceCard'
import { FieldError } from './form/FieldError'
import { FieldGroup } from './form/FieldGroup'
import { FormModal, type FormModalSection } from './form/FormModal'
import { FormSection } from './form/FormSection'
import { MaskedInput } from './form/MaskedInput'
import { MaskedField } from './form/MaskedField'
import { SelectField, TextAreaField, TextField } from './form/TextField'
import { EVENT_TYPES, type EventType, type Service } from '../types/event'
import { TEAM_SPECIALTIES, type TeamSpecialty } from '../types/team'
import type { Rule } from '../types/rule'

type RuleFormProps = { rule?: Rule; onClose: () => void; onCreated: (rule: Rule) => void; onUpdated: (rule: Rule) => void }
type SectionId = 'identification' | 'conditions' | 'resources' | 'tasks'
type RequirementDraft = { specialty: TeamSpecialty; minQuantity: string }
type TaskDraft = { title: string; description: string | null; daysBeforeEvent: string; specialty: TeamSpecialty | '' }

const SECTION_FIELDS: Record<SectionId, readonly string[]> = {
  identification: ['name', 'description'],
  conditions: ['minGuests', 'maxGuests'],
  resources: ['resourceRequirements'],
  tasks: ['taskTemplates'],
}
const SECTION_ORDER: SectionId[] = ['identification', 'conditions', 'resources', 'tasks']
const maskGuests = maskInteger(5)
const maskQuantity = maskInteger(3)
const maskDays = maskInteger(3)
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** Frase de "para quem vale" a regra, mostrada no rodapé da navegação para conferência rápida. */
function describeConditions(types: EventType[], minGuests: string, maxGuests: string, serviceNames: string[]) {
  const parts: string[] = []
  if (types.length) parts.push(types.map((type) => EVENT_TYPE_LABELS[type]).join(' ou '))
  if (minGuests && maxGuests) parts.push(`${minGuests} a ${maxGuests} convidados`)
  else if (minGuests) parts.push(`a partir de ${minGuests} convidados`)
  else if (maxGuests) parts.push(`até ${maxGuests} convidados`)
  if (serviceNames.length) parts.push(`com ${serviceNames.join(', ')}`)
  return parts.length ? `Vale para: ${parts.join(', ')}.` : 'Vale para qualquer evento.'
}

export function RuleForm({ rule, onClose, onCreated, onUpdated }: RuleFormProps) {
  const toast = useToast()
  const [section, setSection] = useState<SectionId>('identification')
  const [name, setName] = useState(rule?.name ?? '')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [serviceTypes, setServiceTypes] = useState<EventType[]>(rule?.conditionServiceTypeIn ?? [])
  const [minGuests, setMinGuests] = useState(rule?.conditionMinGuests != null ? String(rule.conditionMinGuests) : '')
  const [maxGuests, setMaxGuests] = useState(rule?.conditionMaxGuests != null ? String(rule.conditionMaxGuests) : '')
  const [requiredServiceIds, setRequiredServiceIds] = useState<string[]>(rule?.conditionRequiredServiceIds ?? [])
  const [services, setServices] = useState<Service[]>([])
  const [requirements, setRequirements] = useState<RequirementDraft[]>(
    rule?.resourceRequirements.map((item) => ({ specialty: item.specialty, minQuantity: String(item.minQuantity) })) ?? [],
  )
  const [taskTemplates, setTaskTemplates] = useState<TaskDraft[]>(
    rule?.taskTemplates.map((template) => ({ title: template.title, description: template.description, daysBeforeEvent: template.daysBeforeEvent != null ? String(template.daysBeforeEvent) : '', specialty: template.specialty ?? '' })) ?? [],
  )
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const validation = useFormValidation(ruleFormSchema, { name, description, minGuests, maxGuests, resourceRequirements: requirements, taskTemplates })

  useEffect(() => { void listServices().then(setServices).catch((cause) => setApiError(getApiErrorMessage(cause, 'Não foi possível carregar os serviços'))) }, [])

  const toggleServiceType = (type: EventType) => setServiceTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])
  const toggleRequiredService = (serviceId: string) => setRequiredServiceIds((current) => current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId])
  // A task can only point to a specialty the rule requires (ADR 0010): when requirements change,
  // a task whose specialty is no longer required goes back to "no automatic assignment".
  const changeRequirements = (next: RequirementDraft[]) => {
    const required = new Set(next.map((item) => item.specialty))
    setRequirements(next)
    setTaskTemplates((current) => current.map((template) => template.specialty && !required.has(template.specialty) ? { ...template, specialty: '' } : template))
  }
  const addRequirement = () => changeRequirements([...requirements, { specialty: TEAM_SPECIALTIES[0], minQuantity: '1' }])
  const updateRequirement = (index: number, patch: Partial<RequirementDraft>) => changeRequirements(requirements.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  const removeRequirement = (index: number) => changeRequirements(requirements.filter((_, itemIndex) => itemIndex !== index))
  const requiredSpecialties = TEAM_SPECIALTIES.filter((specialty) => requirements.some((item) => item.specialty === specialty))
  const addTaskTemplate = () => setTaskTemplates((current) => [...current, { title: '', description: null, daysBeforeEvent: '', specialty: '' }])
  const updateTaskTemplate = (index: number, patch: Partial<TaskDraft>) => setTaskTemplates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  const removeTaskTemplate = (index: number) => setTaskTemplates((current) => current.filter((_, itemIndex) => itemIndex !== index))

  const invalidIn = (id: SectionId) => hasErrorIn(validation.errors, SECTION_FIELDS[id])
  const sectionState = (id: SectionId) => ({ complete: !invalidIn(id), invalid: validation.submitted && invalidIn(id) })
  const conditionCount = (serviceTypes.length ? 1 : 0) + (minGuests || maxGuests ? 1 : 0) + (requiredServiceIds.length ? 1 : 0)
  const sections: FormModalSection[] = [
    { id: 'identification', label: 'Identificação', description: 'Nome e descrição', ...sectionState('identification') },
    { id: 'conditions', label: 'Condições', description: conditionCount ? plural(conditionCount, 'condição', 'condições') : 'Qualquer evento', ...sectionState('conditions') },
    { id: 'resources', label: 'Recursos exigidos', description: requiredSpecialties.length ? requiredSpecialties.map((item) => TEAM_SPECIALTY_LABELS[item]).join(', ') : 'Nenhum', ...sectionState('resources') },
    { id: 'tasks', label: 'Tarefas geradas', description: plural(taskTemplates.length, 'tarefa', 'tarefas'), ...sectionState('tasks') },
  ]
  const serviceNames = services.filter((service) => requiredServiceIds.includes(service.id)).map((service) => service.name)

  const submit = async () => {
    setApiError('')
    if (!validation.submit()) {
      const firstInvalid = SECTION_ORDER.find(invalidIn)
      if (firstInvalid) setSection(firstInvalid)
      return
    }
    setSubmitting(true)
    try {
      const input = {
        name: name.trim(),
        description: description.trim() || null,
        conditionServiceTypeIn: serviceTypes.length ? serviceTypes : null,
        conditionMinGuests: toOptionalNumber(minGuests),
        conditionMaxGuests: toOptionalNumber(maxGuests),
        conditionRequiredServiceIds: requiredServiceIds.length ? requiredServiceIds : null,
        resourceRequirements: requirements.map((item) => ({ specialty: item.specialty, minQuantity: Number(item.minQuantity) })),
        taskTemplates: taskTemplates.map((template) => ({ title: template.title.trim(), description: template.description?.trim() || null, daysBeforeEvent: toOptionalNumber(template.daysBeforeEvent), specialty: template.specialty || null })),
      }
      const saved = rule ? await updateRule(rule.id, input) : await createRule(input)
      toast.success(rule ? 'Regra atualizada.' : 'Regra criada.')
      if (rule) onUpdated(saved)
      else onCreated(saved)
      onClose()
    } catch (cause) { setApiError(getApiErrorMessage(cause, 'Não foi possível salvar a regra')) } finally { setSubmitting(false) }
  }

  const rowError = (path: string) => validation.errorFor(path)

  return <FormModal title={rule ? 'Editar regra' : 'Nova regra'} subtitle={name.trim() || 'Quando um evento atender às condições, o sistema gera as tarefas.'} icon={<Icon name="bolt" />}
    onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel="Salvar regra" error={apiError} invalidAttempt={validation.invalidAttempt}
    sections={sections} activeSection={section} onSectionChange={(id) => setSection(id as SectionId)}
    railFooter={<p className="fm-summary"><Icon name="bolt" />{describeConditions(serviceTypes, minGuests, maxGuests, serviceNames)}</p>}>
    <FormSection title="Identificação" active={section === 'identification'}>
      <TextField label="Nome da regra" required value={name} maxLength={150} error={validation.errorFor('name')}
        onChange={(event) => setName(event.target.value)} onBlur={(event) => validation.touch('name', event)} />
      <TextAreaField label="Descrição" optional value={description ?? ''} maxLength={2000} placeholder="Para que serve esta regra" error={validation.errorFor('description')}
        onChange={(event) => setDescription(event.target.value)} onBlur={(event) => validation.touch('description', event)} />
    </FormSection>

    <FormSection title="Condições" description="Deixe uma condição em branco para que ela combine com qualquer evento." active={section === 'conditions'}>
      <FieldGroup label="Tipo de evento" optional>
        <div className="fm-choices three">{EVENT_TYPES.map((type) => <ChoiceCard key={type} type="checkbox" title={EVENT_TYPE_LABELS[type]} checked={serviceTypes.includes(type)} onChange={() => toggleServiceType(type)} />)}</div>
      </FieldGroup>
      <FieldGroup label="Faixa de convidados" optional error={validation.errorFor('minGuests') ?? validation.errorFor('maxGuests')}>
        <div className="fm-range">
          <MaskedInput aria-label="Mínimo de convidados" placeholder="Mínimo" inputMode="numeric" value={minGuests} mask={maskGuests} onValueChange={setMinGuests}
            aria-invalid={validation.errorFor('minGuests') ? true : undefined} onBlur={(event) => validation.touch('minGuests', event)} />
          <span>até</span>
          <MaskedInput aria-label="Máximo de convidados" placeholder="Máximo" inputMode="numeric" value={maxGuests} mask={maskGuests} onValueChange={setMaxGuests}
            aria-invalid={validation.errorFor('maxGuests') ? true : undefined} onBlur={(event) => validation.touch('maxGuests', event)} />
        </div>
      </FieldGroup>
      <FieldGroup label="Serviços obrigatórios" optional>
        {services.length === 0
          ? <p className="fm-list fm-list-empty">Nenhum serviço cadastrado. Cadastre serviços para usá-los como condição.</p>
          : <div className="fm-choices three">{services.map((service) => <ChoiceCard key={service.id} type="checkbox" title={service.name} checked={requiredServiceIds.includes(service.id)} onChange={() => toggleRequiredService(service.id)} />)}</div>}
      </FieldGroup>
    </FormSection>

    <FormSection title="Recursos exigidos" description="Quantas equipes de cada especialidade o evento precisa ter." active={section === 'resources'}>
      {requirements.length > 0 && <div className="fm-grid-rows">
        <div className="fm-req-row" aria-hidden="true"><span className="fm-col-title">Especialidade</span><span className="fm-col-title">Qtd. mínima</span><span /></div>
        {requirements.map((requirement, index) => {
          const quantityError = rowError(`resourceRequirements.${index}.minQuantity`)
          return <div key={index}>
            <div className="fm-req-row">
              <select className="fm-input" aria-label={`Especialidade ${index + 1}`} value={requirement.specialty} onChange={(event) => updateRequirement(index, { specialty: event.target.value as TeamSpecialty })}>
                {TEAM_SPECIALTIES.map((specialty) => <option key={specialty} value={specialty}>{TEAM_SPECIALTY_LABELS[specialty]}</option>)}
              </select>
              <MaskedInput aria-label={`Quantidade mínima ${index + 1}`} inputMode="numeric" value={requirement.minQuantity} mask={maskQuantity}
                aria-invalid={quantityError ? true : undefined} aria-describedby={quantityError ? `requirement-${index}-error` : undefined}
                onValueChange={(value) => updateRequirement(index, { minQuantity: value })} onBlur={(event) => validation.touch(`resourceRequirements.${index}.minQuantity`, event)} />
              <button type="button" className="fm-icon-btn" aria-label={`Remover recurso ${index + 1}`} onClick={() => removeRequirement(index)}><Icon name="trash" /></button>
            </div>
            <FieldError id={`requirement-${index}-error`} message={quantityError} />
          </div>
        })}
      </div>}
      {requirements.length === 0 && <p className="fm-list fm-list-empty">Nenhum recurso exigido.</p>}
      <button type="button" className="fm-btn fm-btn-secondary fm-btn-sm fm-self-start" onClick={addRequirement}><Icon name="plus" />Adicionar recurso</button>
    </FormSection>

    <FormSection title="Tarefas geradas" description="Criadas quando o evento é confirmado." active={section === 'tasks'}>
      <p className="fm-hint">{requiredSpecialties.length ? 'Cada tarefa com equipe responsável vai para a equipe da especialidade alocada ao evento que tiver menos tarefas em aberto.' : 'Adicione um recurso exigido para atribuir as tarefas automaticamente.'}</p>
      {taskTemplates.map((template, index) => <section key={index} className="fm-card" aria-label={`Tarefa ${index + 1}`}>
        <div className="fm-card-head">
          <span className="fm-number" aria-hidden="true">{index + 1}</span>
          <h4>{template.title.trim() || 'Nova tarefa'}</h4>
          <button type="button" className="fm-icon-btn fm-push" aria-label={`Remover tarefa ${index + 1}`} onClick={() => removeTaskTemplate(index)}><Icon name="trash" /></button>
        </div>
        <div className="fm-task-grid">
          <TextField label="Título" required aria-label={`Título da tarefa ${index + 1}`} value={template.title} maxLength={150} error={rowError(`taskTemplates.${index}.title`)}
            onChange={(event) => updateTaskTemplate(index, { title: event.target.value })} onBlur={(event) => validation.touch(`taskTemplates.${index}.title`, event)} />
          <MaskedField label="Dias antes" aria-label={`Dias antes do evento ${index + 1}`} inputMode="numeric" value={template.daysBeforeEvent} mask={maskDays} error={rowError(`taskTemplates.${index}.daysBeforeEvent`)}
            onValueChange={(value) => updateTaskTemplate(index, { daysBeforeEvent: value })} onBlur={(event) => validation.touch(`taskTemplates.${index}.daysBeforeEvent`, event)} />
          <SelectField label="Equipe responsável" aria-label={`Equipe responsável ${index + 1}`} value={template.specialty} disabled={requiredSpecialties.length === 0}
            onChange={(event) => updateTaskTemplate(index, { specialty: event.target.value as TeamSpecialty | '' })}>
            <option value="">Sem atribuição automática</option>
            {requiredSpecialties.map((specialty) => <option key={specialty} value={specialty}>{TEAM_SPECIALTY_LABELS[specialty]}</option>)}
          </SelectField>
        </div>
      </section>)}
      <FieldError message={validation.errorFor('taskTemplates')} />
      <button type="button" className="fm-btn fm-btn-secondary fm-btn-sm fm-self-start" disabled={taskTemplates.length >= RULE_TASKS_MAX} onClick={addTaskTemplate}><Icon name="plus" />Adicionar tarefa</button>
    </FormSection>
  </FormModal>
}
