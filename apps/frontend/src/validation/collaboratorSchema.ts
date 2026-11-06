import { z } from 'zod'
import { optionalPhone, requiredText } from './rules'

// Espelha collaboratorBaseSchema (CollaboratorController).
export const collaboratorFormSchema = z.object({
  name: requiredText('Informe o nome do colaborador.', 150),
  position: requiredText('Informe o cargo do colaborador.', 100),
  phone: optionalPhone,
})

export type CollaboratorFormValues = z.input<typeof collaboratorFormSchema>
