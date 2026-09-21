export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand${compact ? ' compact' : ''}`}><span className="logo-mark" aria-hidden="true" /><span><strong>Eventos<span>Pro</span></strong>{!compact && <small>Gestão de Eventos</small>}</span></div>
}