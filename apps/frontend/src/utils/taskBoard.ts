import { getTaskDestinations, TERMINAL_TASK_STATUSES, type TaskStatus } from '../types/task'

/** What the board does when a card is dropped on a column (KAN-77, ADR 0017). */
export type TaskDropDecision = { kind: 'none' } | { kind: 'move' } | { kind: 'confirm' } | { kind: 'reject'; reason: string }

const CLOSED_EVENT_STATUSES = ['CONCLUIDO', 'CANCELADO']

/**
 * Why a move is not allowed, in the user's words, or null when it is allowed (or is no move at all).
 * The matrix itself stays in getTaskDestinations (ADR 0014); this only explains it.
 */
export function getMoveBlockReason(task: { status: TaskStatus }, target: TaskStatus, eventStatus?: string): string | null {
  if (task.status === target || getTaskDestinations(task.status, eventStatus).includes(target)) return null
  if (TERMINAL_TASK_STATUSES.includes(task.status)) return 'Tarefas concluídas ou canceladas não mudam mais de status.'
  if (eventStatus && CLOSED_EVENT_STATUSES.includes(eventStatus)) return 'O evento já foi encerrado: as tarefas abertas só podem ser canceladas.'
  if (task.status === 'PENDENTE' && target === 'CONCLUIDA') return 'Inicie a tarefa antes de concluir: mova primeiro para Em andamento.'
  return 'Movimento não permitido.'
}

/** Cancelling is terminal, so it asks for confirmation; every other valid move happens at once. */
export function decideTaskDrop(task: { status: TaskStatus }, target: TaskStatus, eventStatus?: string): TaskDropDecision {
  if (task.status === target) return { kind: 'none' }
  const reason = getMoveBlockReason(task, target, eventStatus)
  if (reason) return { kind: 'reject', reason }
  return target === 'CANCELADA' ? { kind: 'confirm' } : { kind: 'move' }
}
