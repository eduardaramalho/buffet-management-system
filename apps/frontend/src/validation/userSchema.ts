import { z } from 'zod'
import { requiredChoice, requiredText } from './rules'

export const PASSWORD_MIN_LENGTH = 8

const email = z.string().trim().min(1, 'Informe o e-mail.').pipe(z.email('Informe um e-mail válido, por exemplo nome@empresa.com.'))

// Espelha updateSchema do UserController: a edição não altera papel nem senha (ADR 0012).
export const userUpdateFormSchema = z.object({
  name: requiredText('Informe o nome.', 150, 2),
  email,
})

// Espelha createSchema do UserController.
export const userCreateFormSchema = userUpdateFormSchema.extend({
  password: z.string().min(1, 'Informe a senha inicial.').min(PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`),
  roleId: requiredChoice('Selecione o papel do usuário.'),
})

export type UserCreateFormValues = z.input<typeof userCreateFormSchema>
