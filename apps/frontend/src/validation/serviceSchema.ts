import { z } from 'zod'
import { requiredText } from './rules'

export const SERVICE_NAME_MAX = 100

// Espelha serviceBaseSchema (ServiceController). A unicidade do nome é conferida pela API (409).
export const serviceFormSchema = z.object({ name: requiredText('Informe o nome do serviço.', SERVICE_NAME_MAX) })

export type ServiceFormValues = z.input<typeof serviceFormSchema>
