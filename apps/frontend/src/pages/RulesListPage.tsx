import { useEffect, useState } from 'react'
import { listRules, setRuleActive, removeRule } from '../api/rulesApi'
import { Badge } from '../components/Badge'
import { Notice } from '../components/Notice'
import { Pagination } from '../components/Pagination'
import { RuleForm } from '../components/RuleForm'
import { StatCard } from '../components/StatCard'
import { Table } from '../components/Table'
import type { EventType } from '../types/event'
import type { TeamSpecialty } from '../types/team'
import type { Rule } from '../types/rule'

const PAGE_SIZE = 10
const eventTypeLabels: Record<EventType, string> = { CASAMENTO: 'Casamento', ANIVERSARIO: 'Aniversário', FORMATURA: 'Formatura', CORPORATIVO: 'Corporativo', CONFRATERNIZACAO: 'Confraternização', BATIZADO: 'Batizado', OUTRO: 'Outro' }
const specialtyLabels: Record<TeamSpecialty, string> = { COZINHA: 'Cozinha', SALAO: 'Salão', BAR: 'Bar', DECORACAO: 'Decoração', LIMPEZA: 'Limpeza', CERIMONIAL: 'Cerimonial', OUTRO: 'Outro' }

const summarizeConditions = (rule: Rule) => {
  const parts: string[] = []
  if (rule.conditionServiceTypeIn?.length) parts.push(`Tipo: ${rule.conditionServiceTypeIn.map((type) => eventTypeLabels[type]).join(', ')}`)
  if (rule.conditionMinGuests != null) parts.push(`Mín. ${rule.conditionMinGuests} convidados`)
  if (rule.conditionMaxGuests != null) parts.push(`Máx. ${rule.conditionMaxGuests} convidados`)
  if (rule.conditionRequiredServiceIds?.length) parts.push(`${rule.conditionRequiredServiceIds.length} serviço(s) obrigatório(s)`)
  return parts.length ? parts.join(' • ') : 'Sem condições (casa com qualquer evento)'
}
const summarizeResources = (rule: Rule) => rule.resourceRequirements.map((item) => `${specialtyLabels[item.specialty]} ×${item.minQuantity}`).join(', ') || '—'

export function RulesListPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule>()

  const load = async (value = search) => {
    try { setRules(await listRules({ search: value || undefined })); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao carregar regras') }
  }
  useEffect(() => { void load('') }, [])
  const totalPages = Math.max(1, Math.ceil(rules.length / PAGE_SIZE))
  const visibleRules = rules.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const openForm = (rule?: Rule) => { setEditingRule(rule); setFormOpen(true) }
  const addRule = (rule: Rule) => { setRules((current) => [rule, ...current]); setPage(1) }
  const replaceRule = (rule: Rule) => setRules((current) => current.map((item) => item.id === rule.id ? rule : item))
  const changeStatus = async (rule: Rule) => {
    if (rule.isActive && !window.confirm(`Desativar a regra ${rule.name}?`)) return
    try { replaceRule(await setRuleActive(rule.id, !rule.isActive)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao alterar status da regra') }
  }
  const remove = async (rule: Rule) => {
    if (!window.confirm(`Excluir a regra ${rule.name}?`)) return
    try { await removeRule(rule.id); setRules((current) => current.filter((item) => item.id !== rule.id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao excluir regra') }
  }

  return <main className="app-shell">
    <header><div><span className="eyebrow">MOTOR DE REGRAS</span><h1>Regras</h1></div><button className="secondary" onClick={() => openForm()}>Nova regra</button></header>
    <section className="summary">
      <StatCard icon="⚙" value={rules.length} label="Total de regras" tone="blue" />
      <StatCard icon="✓" value={rules.filter((rule) => rule.isActive).length} label="Regras ativas" tone="green" />
      <StatCard icon="◌" value={rules.filter((rule) => !rule.isActive).length} label="Inativas" tone="gold" />
    </section>
    <section className="content-head"><input className="search" placeholder="Buscar por nome..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); void load(event.target.value) }} /></section>
    {error && <Notice message={error} error />}
    <Table headers={['Regra', 'Condições', 'Recursos exigidos', 'Status', 'Ações']}>
      {visibleRules.map((rule) => <tr key={rule.id}>
        <td><strong>{rule.name}</strong></td>
        <td>{summarizeConditions(rule)}</td>
        <td>{summarizeResources(rule)}</td>
        <td><Badge tone={rule.isActive ? 'active' : 'inactive'}>{rule.isActive ? 'Ativa' : 'Inativa'}</Badge></td>
        <td><div className="row-actions">
          <button title="Editar regra" aria-label={`Editar ${rule.name}`} onClick={() => openForm(rule)}>✎</button>
          <button title={rule.isActive ? 'Desativar regra' : 'Ativar regra'} aria-label={`${rule.isActive ? 'Desativar' : 'Ativar'} ${rule.name}`} onClick={() => void changeStatus(rule)}>{rule.isActive ? '◌' : '●'}</button>
          <button title="Excluir regra" aria-label={`Excluir ${rule.name}`} onClick={() => void remove(rule)}>×</button>
        </div></td>
      </tr>)}
    </Table>
    {rules.length === 0 && <div className="empty">Nenhuma regra encontrada.</div>}
    <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={setPage} />
    {formOpen && <RuleForm rule={editingRule} onClose={() => { setFormOpen(false); setEditingRule(undefined) }} onCreated={(rule) => { addRule(rule); setFormOpen(false) }} onUpdated={(rule) => { replaceRule(rule); setFormOpen(false); setEditingRule(undefined) }} />}
  </main>
}
