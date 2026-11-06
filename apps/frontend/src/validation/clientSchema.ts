import { z } from 'zod'
import { CLIENT_TYPES } from '../types/client'
import { isValidCnpj, isValidCpf } from '../utils/document'
import { unmaskDocument } from '../utils/masks'
import { optionalPhone, optionalText, requiredText, tooLong } from './rules'

const EMAIL_MAX = 150
const emailSchema = z.email()

// Espelha clientBaseSchema (ClientController) e a validação de CPF/CNPJ do ClientService.
export const clientFormSchema = z.object({
  type: z.enum(CLIENT_TYPES),
  name: requiredText('Informe o nome do cliente.', 150),
  document: z.string().max(18, tooLong(18)),
  email: z.string().trim().max(EMAIL_MAX, tooLong(EMAIL_MAX))
    .refine((value) => value === '' || emailSchema.safeParse(value).success, 'Informe um e-mail válido, por exemplo nome@empresa.com.'),
  phone: optionalPhone,
  notes: optionalText(2000),
}).superRefine((values, context) => {
  if (!values.document.trim()) return
  const document = unmaskDocument(values.document)
  const valid = values.type === 'PF' ? isValidCpf(document) : isValidCnpj(document)
  if (!valid) context.addIssue({ code: 'custom', path: ['document'], message: values.type === 'PF' ? 'CPF inválido. Confira os números digitados.' : 'CNPJ inválido. Confira os caracteres digitados.' })
})

export type ClientFormValues = z.input<typeof clientFormSchema>
