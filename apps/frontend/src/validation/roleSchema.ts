import { z } from 'zod'
import { optionalText, requiredText } from './rules'

export const ROLE_DESCRIPTION_MAX = 255

// Espelha createSchema/updateSchema do RoleController (nome de 2 a 50 caracteres).
export const roleFormSchema = z.object({
  name: requiredText('Informe o nome do papel.', 50, 2),
  description: optionalText(ROLE_DESCRIPTION_MAX),
})

export type RoleFormValues = z.input<typeof roleFormSchema>
