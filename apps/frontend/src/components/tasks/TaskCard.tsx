import { useDraggable } from '@dnd-kit/core'
import type { Task } from '../../types/task'
import { isTaskOverdue } from '../../utils/taskSchedule'
import { Icon } from '../Icon'

export type TaskCardHighlight = 'rejected' | 'moved'

type TaskCardProps = {
  task: Task
  eventLabel: string
  teamName?: string
  saving?: boolean
  highlight?: TaskCardHighlight
  onOpen?: () => void
}

const dayMonth = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(value))

function CardContent({ task, eventLabel, teamName, saving = false, onOpen }: TaskCardProps) {
  const overdue = isTaskOverdue(task)
  return <>
    <div className="task-card-head">
      <h3 className="task-card-title">
        {onOpen ? <button type="button" className="task-card-open" onClick={onOpen}>{task.title}</button> : task.title}
      </h3>
      {task.sourceRuleId && <span className="task-rule-badge" title="Gerada pelo motor de regras">Regra</span>}
    </div>
    <p className="task-card-event">{eventLabel}</p>
    <div className="task-card-chips">
      {task.assignedTeamId
        ? <span className="task-chip"><Icon name="users" />{teamName ?? 'Equipe'}</span>
        : <span className="task-chip is-warning"><Icon name="alert" />Sem equipe</span>}
      {task.dueDate && <span className={`task-chip${overdue ? ' is-overdue' : ''}`}><Icon name="clock" />{overdue ? `Atrasada · ${dayMonth(task.dueDate)}` : dayMonth(task.dueDate)}</span>}
      {saving && <span className="task-saving" role="status" aria-label="Salvando" />}
    </div>
  </>
}

/**
 * Card arrastável do quadro (KAN-77). Clicar abre o detalhe; arrastar move entre colunas.
 * O PointerSensor só começa o arraste depois de alguns pixels, então um clique simples continua sendo clique.
 * Os atributos de acessibilidade do dnd-kit não são aplicados ao <article> para não aninhar um role="button"
 * em volta do botão do título: a alternativa acessível ao arraste é o "Mover para" do detalhe.
 */
export function DraggableTaskCard({ highlight, ...props }: TaskCardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: props.task.id, data: { title: props.task.title } })
  const classes = ['task-card', isDragging && 'is-dragging', highlight === 'rejected' && 'is-rejected', highlight === 'moved' && 'is-moved'].filter(Boolean).join(' ')
  return <article ref={setNodeRef} className={classes} {...listeners}>
    <CardContent {...props} />
  </article>
}

/** Cópia exibida sob o cursor durante o arraste (DragOverlay): só visual, fora da árvore de acessibilidade. */
export function TaskCardPreview(props: Omit<TaskCardProps, 'onOpen' | 'highlight'>) {
  return <article className="task-card is-overlay" aria-hidden="true">
    <CardContent {...props} />
  </article>
}
