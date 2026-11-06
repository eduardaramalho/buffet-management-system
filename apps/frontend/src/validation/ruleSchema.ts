import { z } from 'zod'
import { TEAM_SPECIALTIES } from '../types/team'
import { integerText, optionalText, requiredText } from './rules'

export const RULE_TASKS_MAX = 20
const DAYS_BEFORE_MAX = 365
// A API não limita o número de convidados das condições; o teto só evita números sem sentido na tela.
const GUESTS_CONDITION_MAX = 99999

// Espelha ruleBaseSchema, resourceRequirementSchema e taskTemplateSchema (RuleController).
export const ruleFormSchema = z.object({
  name: requiredText('Informe o nome da regra.', 150),
  description: optionalText(2000),
  minGuests: integerText({ min: 0, max: GUESTS_CONDITION_MAX }),
  maxGuests: integerText({ min: 0, max: GUESTS_CONDITION_MAX }),
  resourceRequirements: z.array(z.object({
    specialty: z.enum(TEAM_SPECIALTIES),
    minQuantity: integerText({ required: 'Informe a quantidade mínima.', min: 1, max: 999, minMessage: 'A quantidade mínima é 1.' }),
  })),
  taskTemplates: z.array(z.object({
    title: requiredText('Informe o título da tarefa.', 150),
    daysBeforeEvent: integerText({ min: 0, max: DAYS_BEFORE_MAX, maxMessage: `Use no máximo ${DAYS_BEFORE_MAX} dias.` }),
    specialty: z.string(),
  })).max(RULE_TASKS_MAX, `Uma regra pode gerar no máximo ${RULE_TASKS_MAX} tarefas.`),
}).superRefine((values, context) => {
  if (values.minGuests !== '' && values.maxGuests !== '' && Number(values.minGuests) > Number(values.maxGuests)) {
    context.addIssue({ code: 'custom', path: ['maxGuests'], message: 'O máximo de convidados não pode ser menor que o mínimo.' })
  }
})

export type RuleFormValues = z.input<typeof ruleFormSchema>
