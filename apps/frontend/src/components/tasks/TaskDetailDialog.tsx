import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { getApiErrorMessage } from '../../api/apiError'
import { createTaskComment, listTaskComments, updateTask } from '../../api/tasksApi'
import { useToast } from '../../contexts/toast'
import { useModalDialog } from '../../hooks/useModalDialog'
import { getTaskDestinations, TERMINAL_TASK_STATUSES, type Task, type TaskStatus } from '../../types/task'
import { TASK_COMMENT_MAX_LENGTH, type TaskComment } from '../../types/taskComment'
import { isTaskOverdue } from '../../utils/taskSchedule'
import { Icon } from '../Icon'
import { Notice } from '../Notice'
import { TASK_STATUS_LABELS } from '../../utils/labels'
import { initials } from '../../utils/initials'

export type TaskDetailPermissions = {
  /** tasks:update-status */
  move: boolean
  /** tasks:update: descrição e o formulário completo (título, prazo, equipe). */
  editDetails: boolean
  /** tasks:delete */
  delete: boolean
  /** tasks:comment */
  comment: boolean
}

type TaskDetailDialogProps = {
  task: Task
  event?: { name: string; eventDate: string; status: string }
  teamName?: string
  permissions: TaskDetailPermissions
  /** Uma mudança de status desta tarefa está sendo salva. */
  saving: boolean
  onClose: () => void
  onMove: (status: TaskStatus) => void
  onTaskUpdated: (task: Task) => void
  onEdit: () => void
  onDelete: () => void
}

const fullDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
const dateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

/**
 * Detalhe da tarefa aberto ao clicar no card (KAN-77). Também é a alternativa ao arraste para quem usa
 * teclado ou leitor de tela: os botões de "Mover para" oferecem só as transições válidas (ADR 0014).
 */
export function TaskDetailDialog({ task, event, teamName, permissions, saving, onClose, onMove, onTaskUpdated, onEdit, onDelete }: TaskDetailDialogProps) {
  const toast = useToast()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const handleKeyDown = useModalDialog(dialogRef, { onClose })
  const terminal = TERMINAL_TASK_STATUSES.includes(task.status)
  const destinations = getTaskDestinations(task.status, event?.status)
  const canEditDetails = permissions.editDetails && !terminal

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.description ?? '')
  const [savingDescription, setSavingDescription] = useState(false)
  const [descriptionError, setDescriptionError] = useState('')

  const [comments, setComments] = useState<TaskComment[]>([])
  const [commentsState, setCommentsState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [commentError, setCommentError] = useState('')

  useEffect(() => { dialogRef.current?.focus() }, [])

  useEffect(() => {
    let active = true
    listTaskComments(task.id)
      .then((loaded) => { if (active) { setComments(loaded); setCommentsState('ready') } })
      .catch(() => { if (active) setCommentsState('error') })
    return () => { active = false }
  }, [task.id])

  const startEditing = () => { setDraft(task.description ?? ''); setDescriptionError(''); setEditing(true) }
  const descriptionChanged = draft.trim() !== (task.description ?? '').trim()

  const saveDescription = async (formEvent: FormEvent) => {
    formEvent.preventDefault()
    if (!descriptionChanged || savingDescription) return
    setSavingDescription(true)
    setDescriptionError('')
    try {
      const updated = await updateTask(task.id, { description: draft.trim() || null })
      onTaskUpdated(updated)
      setEditing(false)
      toast.success('Descrição salva.')
    } catch (cause) {
      setDescriptionError(getApiErrorMessage(cause, 'Não foi possível salvar a descrição.'))
    } finally {
      setSavingDescription(false)
    }
  }

  const postComment = async (formEvent: FormEvent) => {
    formEvent.preventDefault()
    const body = comment.trim()
    if (!body || posting) return
    setPosting(true)
    setCommentError('')
    try {
      const created = await createTaskComment(task.id, body)
      setComments((current) => [...current, created])
      setComment('')
    } catch (cause) {
      setCommentError(getApiErrorMessage(cause, 'Não foi possível enviar o comentário.'))
    } finally {
      setPosting(false)
    }
  }

  const overdue = isTaskOverdue(task)

  return createPortal(<div className="fm-backdrop" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose() }}>
    <div ref={dialogRef} className="fm-dialog task-detail" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={handleKeyDown}>
      <header className="task-detail-head">
        <div className="task-detail-heading">
          <div className="task-detail-badges">
            <span className={`task-status-pill status-${task.status.toLowerCase()}`}>{TASK_STATUS_LABELS[task.status]}</span>
            <span className="task-origin-pill">{task.sourceRuleId ? 'Gerada pelo motor de regras' : 'Criada manualmente'}</span>
          </div>
          <h2 id={titleId}>{task.title}</h2>
          <p>{event ? `${event.name} · ${fullDate(event.eventDate)}` : 'Evento não encontrado'}</p>
        </div>
        <button type="button" className="fm-close" aria-label="Fechar detalhe" onClick={onClose}><Icon name="x" /></button>
      </header>

      <div className="task-detail-body">
        <div className="task-detail-main">
          <section className="task-detail-section" aria-labelledby={`${titleId}-description`}>
            <div className="task-detail-section-head">
              <h3 id={`${titleId}-description`}>Descrição</h3>
              {canEditDetails && !editing && <button type="button" className="panel-link" aria-label={task.description ? 'Editar descrição' : 'Adicionar descrição'} onClick={startEditing}>
                {task.description ? 'Editar' : 'Adicionar'}
              </button>}
            </div>
            {!editing && (task.description
              ? <p className="task-detail-description">{task.description}</p>
              : <p className="task-detail-empty">Sem descrição.</p>)}
            {editing && <form className="task-detail-form" onSubmit={(formEvent) => void saveDescription(formEvent)}>
              {descriptionError && <Notice message={descriptionError} error />}
              <label className="task-detail-label">Descrição da tarefa
                <textarea value={draft} rows={5} autoFocus placeholder="Itens a conferir, contatos, observações do cliente..." onChange={(changeEvent) => setDraft(changeEvent.target.value)} />
              </label>
              <div className="task-detail-actions">
                <button type="button" className="fm-btn fm-btn-secondary" disabled={savingDescription} onClick={() => setEditing(false)}>Cancelar</button>
                <button type="submit" className="fm-btn fm-btn-primary" aria-label="Salvar descrição" disabled={!descriptionChanged || savingDescription} aria-busy={savingDescription}>
                  {savingDescription ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>}
          </section>

          <section className="task-detail-section" aria-labelledby={`${titleId}-comments`}>
            <h3 id={`${titleId}-comments`}>Comentários ({comments.length})</h3>
            {commentsState === 'loading' && <p className="task-detail-empty">Carregando comentários...</p>}
            {commentsState === 'error' && <Notice message="Não foi possível carregar os comentários." error />}
            {commentsState === 'ready' && comments.length === 0 && <p className="task-detail-empty">Nenhum comentário ainda.</p>}
            {comments.length > 0 && <ol className="task-comment-list">
              {comments.map((item) => <li key={item.id}>
                <span className="task-comment-avatar" aria-hidden="true">{initials(item.authorName)}</span>
                <div>
                  <span className="task-comment-meta"><strong>{item.authorName}</strong> · <time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></span>
                  <p>{item.body}</p>
                </div>
              </li>)}
            </ol>}
            {permissions.comment && <form className="task-detail-form" onSubmit={(formEvent) => void postComment(formEvent)}>
              {commentError && <Notice message={commentError} error />}
              <label className="task-detail-label">Novo comentário
                <textarea value={comment} rows={2} maxLength={TASK_COMMENT_MAX_LENGTH} placeholder="Escreva um comentário para a equipe..." onChange={(changeEvent) => setComment(changeEvent.target.value)} />
              </label>
              <div className="task-detail-actions">
                <button type="submit" className="fm-btn fm-btn-primary" disabled={!comment.trim() || posting} aria-busy={posting}>{posting ? 'Enviando...' : 'Comentar'}</button>
              </div>
            </form>}
          </section>
        </div>

        <aside className="task-detail-side">
          {permissions.move && <section className="task-detail-moves">
            <h3 id={`${titleId}-moves`}>Mover para</h3>
            {destinations.length > 0
              ? <div role="group" aria-labelledby={`${titleId}-moves`} className="task-move-list">
                {destinations.map((status) => <button key={status} type="button" className="task-move-button" disabled={saving} onClick={() => onMove(status)}>
                  <span className={`task-status-dot-sm status-${status.toLowerCase()}`} aria-hidden="true" />{TASK_STATUS_LABELS[status]}
                </button>)}
              </div>
              : <p className="task-detail-empty">{terminal ? 'Tarefa encerrada: o status não muda mais.' : 'Sem movimentos disponíveis.'}</p>}
          </section>}
          <dl className="task-detail-meta">
            <dt>Equipe</dt><dd>{teamName ?? 'Sem equipe'}</dd>
            <dt>Prazo</dt><dd className={overdue ? 'is-overdue' : undefined}>{task.dueDate ? fullDate(task.dueDate) : 'Sem prazo'}{overdue && ' (atrasada)'}</dd>
          </dl>
          {(canEditDetails || (permissions.delete && !terminal)) && <div className="task-detail-side-actions">
            {canEditDetails && <button type="button" className="fm-btn fm-btn-secondary" onClick={onEdit}><Icon name="pencil" />Editar tarefa</button>}
            {permissions.delete && !terminal && <button type="button" className="task-delete-button" onClick={onDelete}><Icon name="trash" />Excluir tarefa</button>}
          </div>}
        </aside>
      </div>
    </div>
  </div>, document.body)
}
