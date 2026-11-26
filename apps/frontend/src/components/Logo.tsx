// Ícone da marca: agenda (planejamento) com um brilho dourado (o evento).
// É o mesmo desenho de public/favicon.svg; ao alterar um, altere o outro.
export function LogoMark({ className = 'logo-mark' }: Readonly<{ className?: string }>) {
  return <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect width="64" height="64" rx="14" fill="#102650" />
    <rect x="13" y="17" width="38" height="35" rx="6" fill="#ffffff" />
    <rect x="13" y="17" width="38" height="9" rx="6" fill="#d7e0ef" />
    <rect x="13" y="22" width="38" height="4" fill="#d7e0ef" />
    <rect x="21" y="11" width="5" height="11" rx="2.5" fill="#e5a72d" />
    <rect x="38" y="11" width="5" height="11" rx="2.5" fill="#e5a72d" />
    <path d="M32 29c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z" fill="#e5a72d" />
  </svg>
}

export function Logo({ compact = false }: Readonly<{ compact?: boolean }>) {
  return <div className={`brand${compact ? ' compact' : ''}`}><LogoMark /><span><strong>Eventos<span>Pro</span></strong>{!compact && <small>Gestão de Eventos</small>}</span></div>
}
