import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import type { TaskStatus } from '../../types/task'
import { TASK_STATUS_LABELS } from '../../utils/labels'

/** Estado da coluna enquanto um card é arrastado: de onde ele saiu, se aceita o card ou se recusa. */
export type ColumnDropState = 'idle' | 'origin' | 'allowed' | 'blocked'

type TaskColumnProps = {
  status: TaskStatus
  count: number
  dropState: ColumnDropState
  /** Motivo da recusa, exibido nas colunas bloqueadas durante o arraste. */
  blockedReason?: string | null
  children: ReactNode
}

export function TaskColumn({ status, count, dropState, blockedReason, children }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const label = TASK_STATUS_LABELS[status]
  const classes = ['task-column', dropState !== 'idle' && `is-${dropState}`, isOver && dropState !== 'origin' && 'is-over'].filter(Boolean).join(' ')

  return <section ref={setNodeRef} className={classes} aria-label={label}>
    <h2 className="task-column-title">
      <span className={`task-status-dot-sm status-${status.toLowerCase()}`} aria-hidden="true" />
      {label}
      <span className="task-column-count">{count}</span>
    </h2>
    {dropState === 'allowed' && <p className="task-column-hint is-allowed">Solte aqui para mover</p>}
    {dropState === 'blocked' && blockedReason && <p className="task-column-hint is-blocked">{blockedReason}</p>}
    {children}
    {count === 0 && dropState === 'idle' && <p className="task-column-empty">Nenhuma tarefa.</p>}
  </section>
}
