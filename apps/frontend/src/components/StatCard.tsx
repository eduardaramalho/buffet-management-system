import type { ReactNode } from 'react'
import { Icon } from './Icon'

const legacyIconNames: Record<string, 'calendar' | 'tasks' | 'users' | 'user' | 'bolt' | 'shield' | 'alert' | 'check' | 'x'> = { '◈': 'calendar', '▣': 'check', '☰': 'tasks', '♜': 'users', '♙': 'users', '☺': 'user', '⚙': 'bolt', '◌': 'x', '⚠': 'alert', '✓': 'check' }

export function StatCard({ icon, value, label, tone }: { icon: ReactNode; value: number | string; label: string; tone: 'blue' | 'green' | 'gold' | 'purple' }) { const renderedIcon = typeof icon === 'string' && legacyIconNames[icon] ? <Icon name={legacyIconNames[icon]} /> : icon; return <article className={`stat-card stat-${tone}`}><span className="stat-icon">{renderedIcon}</span><div><strong>{value}</strong><span>{label}</span></div></article> }