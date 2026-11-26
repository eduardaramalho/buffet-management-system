import { useEffect, useId, useRef, useState } from 'react'
import { CLOSED_EVENT_STATUSES } from '../../types/task'
import { Icon } from '../Icon'

type FilterEvent = { id: string; name: string; eventDate: string; status: string }
type FilterTeam = { id: string; name: string }

type TaskFilterMenuProps = {
  /** null: o usuário não pode listar equipes (colaborador), então o filtro de equipe não aparece. */
  teams: FilterTeam[] | null
  events: FilterEvent[]
  teamId: string
  eventId: string
  onTeamChange: (teamId: string) => void
  onEventChange: (eventId: string) => void
  onClear: () => void
}

const dayMonth = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(value))

function toggleLabel(activeCount: number) {
  if (activeCount === 0) return 'Filtros'
  return `Filtros (${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'})`
}

function eventOptionLabel(event: FilterEvent) {
  const closed = CLOSED_EVENT_STATUSES.has(event.status) ? ' (encerrado)' : ''
  return `${event.name} · ${dayMonth(event.eventDate)}${closed}`
}

/**
 * Filtros do quadro escondidos atrás do botão de três pontos (KAN-77). O botão mostra quantos filtros
 * estão ativos, para o usuário saber que o quadro está filtrado mesmo com o painel fechado.
 */
export function TaskFilterMenu({ teams, events, teamId, eventId, onTeamChange, onEventChange, onClear }: Readonly<TaskFilterMenuProps>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLFieldSetElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const activeCount = (teamId ? 1 : 0) + (eventId ? 1 : 0)
  const label = toggleLabel(activeCount)
  const sortedEvents = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate))

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [open])

  const close = () => { setOpen(false); toggleRef.current?.focus() }

  // Esc fecha o painel e devolve o foco ao botão. Listener nativo: o painel é um <fieldset>, não um controle.
  useEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      toggleRef.current?.focus()
    }
    panel.addEventListener('keydown', closeOnEscape)
    return () => panel.removeEventListener('keydown', closeOnEscape)
  }, [open])

  return <div ref={rootRef} className="task-filter-menu">
    <button ref={toggleRef} type="button" className={`task-filter-toggle${activeCount ? ' is-active' : ''}`} aria-label={label} title="Filtros" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)}>
      <Icon name="more" />
      {activeCount > 0 && <span className="task-filter-count" aria-hidden="true">{activeCount}</span>}
    </button>
    {open && <fieldset ref={panelRef} id={panelId} className="task-filter-panel" aria-label="Filtros do quadro">
      <span className="task-filter-title">Filtros</span>
      {teams && <label className="task-filter-field"><span>Equipe</span>
        <select value={teamId} onChange={(changeEvent) => onTeamChange(changeEvent.target.value)}>
          <option value="">Todas as equipes</option>
          {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </label>}
      <label className="task-filter-field"><span>Evento</span>
        <select value={eventId} onChange={(changeEvent) => onEventChange(changeEvent.target.value)}>
          <option value="">Todos os eventos</option>
          {sortedEvents.map((event) => <option key={event.id} value={event.id}>
            {eventOptionLabel(event)}
          </option>)}
        </select>
      </label>
      <div className="task-filter-actions">
        <button type="button" className="task-filter-clear" disabled={activeCount === 0} onClick={onClear}>Limpar filtros</button>
        <button type="button" className="task-filter-close" onClick={close}>Fechar</button>
      </div>
    </fieldset>}
  </div>
}
