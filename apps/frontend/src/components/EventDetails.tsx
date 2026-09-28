import { useState } from 'react'
import axios from 'axios'
import { getEventRuleMatches } from '../api/rulesApi'
import { Button } from './Button'
import { Notice } from './Notice'
import type { Event } from '../types/event'
import type { MatchedRule } from '../types/rule'

const apiErrorMessage = (cause: unknown) => axios.isAxiosError(cause) ? cause.response?.data?.message ?? 'Não foi possível testar as regras' : cause instanceof Error ? cause.message : 'Não foi possível testar as regras'

// Preview-only: calls the read-only rule-matches endpoint, no task/team is created here (Part 2).
export function EventDetails({ event, onClose }: { event: Event; onClose: () => void }) {
  const [matches, setMatches] = useState<MatchedRule[]>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const testRules = async () => {
    setLoading(true); setError('')
    try { setMatches(await getEventRuleMatches(event.id)) }
    catch (cause) { setError(apiErrorMessage(cause)) }
    finally { setLoading(false) }
  }

  return <aside className="user-form-panel" role="dialog" aria-modal="true" aria-labelledby="event-details-title"><div className="form-wrap">
    <button type="button" className="link-button" onClick={onClose}>Fechar</button>
    <h2 id="event-details-title">Visualizar evento</h2>
    <p><strong>Nome:</strong> {event.name}</p>
    <p><strong>Local:</strong> {event.location}</p>
    <p><strong>Tipo de serviço:</strong> {event.serviceType}</p>
    <p><strong>Convidados:</strong> {event.guestsCount}</p>
    <p><strong>Status:</strong> {event.status}</p>

    <h3>Motor de regras</h3>
    <p className="muted">Consulta apenas: verifica quais regras casam com este evento, sem gerar tarefas ou alocar equipes.</p>
    <Button type="button" className="secondary" onClick={() => void testRules()} disabled={loading}>{loading ? 'Testando...' : 'Testar regra'}</Button>
    {error && <Notice message={error} error />}
    {matches && (matches.length === 0
      ? <p className="empty">Nenhuma regra corresponde a este evento.</p>
      : <ul className="rule-match-list">
          {matches.map(({ rule, resourceRequirements }) => <li key={rule.id}>
            <strong>{rule.name}</strong>
            {rule.description && <p>{rule.description}</p>}
            <p>Recursos exigidos: {resourceRequirements.map((requirement) => `${requirement.specialty} ×${requirement.minQuantity}`).join(', ') || '—'}</p>
          </li>)}
        </ul>)}
  </div></aside>
}
