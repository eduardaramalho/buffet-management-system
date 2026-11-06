import { z } from 'zod'
import { TASK_TITLE_MAX_LENGTH } from '../types/task'
import { requiredChoice, requiredText } from './rules'

// Espelha createSchema/updateSchema do TaskController. O título de tarefa gerada por regra não é editável,
// por isso não é validado (nem enviado) nesse caso.
export const taskFormSchema = (isGenerated: boolean) => z.object({
  eventId: requiredChoice('Selecione o evento.'),
  title: isGenerated ? z.string() : requiredText('Informe o título da tarefa.', TASK_TITLE_MAX_LENGTH),
  description: z.string(),
  dueDate: z.string(),
  assignedTeamId: z.string(),
})

export type TaskFormValues = z.input<ReturnType<typeof taskFormSchema>>
