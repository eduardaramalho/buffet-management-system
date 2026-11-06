import { z } from 'zod'
import { EVENT_TYPES } from '../types/event'
import { integerText, optionalText, requiredChoice, requiredText, tooLong } from './rules'

export const GUESTS_MAX = 5000
const CUSTOM_LABEL_MAX = 255

// Espelha eventBaseSchema (event.schemas.ts) e o customLabel do vínculo de serviço (EventController).
export const eventFormSchema = z.object({
  clientId: requiredChoice('Selecione o cliente do evento.'),
  name: requiredText('Informe o nome do evento.', 150, 3),
  eventDate: requiredChoice('Informe a data e a hora do evento.'),
  serviceType: z.enum(EVENT_TYPES, { message: 'Selecione o tipo de evento.' }),
  location: requiredText('Informe o local do evento.', 200),
  guestsCount: integerText({ required: 'Informe o número de convidados.', min: 1, max: GUESTS_MAX, minMessage: 'O evento precisa ter pelo menos 1 convidado.', maxMessage: `O limite é de ${GUESTS_MAX} convidados.` }),
  observations: optionalText(2000),
  customSelected: z.boolean(),
  customLabel: z.string().max(CUSTOM_LABEL_MAX, tooLong(CUSTOM_LABEL_MAX)),
}).superRefine((values, context) => {
  if (values.customSelected && !values.customLabel.trim()) context.addIssue({ code: 'custom', path: ['customLabel'], message: 'Informe qual é o serviço "Outro".' })
})

export type EventFormValues = z.input<typeof eventFormSchema>
