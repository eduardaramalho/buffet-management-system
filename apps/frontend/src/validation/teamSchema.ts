import { z } from 'zod'
import { TEAM_SPECIALTIES } from '../types/team'
import { optionalText, requiredText } from './rules'

// Espelha teamBaseSchema (TeamController). A regra de um líder por equipe é garantida pela própria tela.
export const teamFormSchema = z.object({
  name: requiredText('Informe o nome da equipe.', 150),
  specialty: z.enum(TEAM_SPECIALTIES, { message: 'Selecione a especialidade.' }),
  observations: optionalText(2000),
})

export type TeamFormValues = z.input<typeof teamFormSchema>
