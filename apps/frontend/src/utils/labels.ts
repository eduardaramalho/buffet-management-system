import type { EventStatus, EventType } from '../types/event'
import type { TaskStatus } from '../types/task'
import type { TeamSpecialty } from '../types/team'

// Shared pt-BR labels for domain enums. Older pages still keep local copies; new screens import from here.
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = { PLANEJAMENTO: 'Planejamento', CONFIRMADO: 'Confirmado', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' }
export const EVENT_TYPE_LABELS: Record<EventType, string> = { CASAMENTO: 'Casamento', ANIVERSARIO: 'Aniversário', FORMATURA: 'Formatura', CORPORATIVO: 'Corporativo', CONFRATERNIZACAO: 'Confraternização', BATIZADO: 'Batizado', OUTRO: 'Outro' }
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = { PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' }
export const TEAM_SPECIALTY_LABELS: Record<TeamSpecialty, string> = { COZINHA: 'Cozinha', SALAO: 'Salão', BAR: 'Bar', DECORACAO: 'Decoração', LIMPEZA: 'Limpeza', CERIMONIAL: 'Cerimonial', OUTRO: 'Outro' }

// Same colors as the dashboard task chart.
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = { PENDENTE: '#e5a72d', EM_ANDAMENTO: '#0d56bd', CONCLUIDA: '#278243', CANCELADA: '#c24c43' }
export const EVENT_STATUS_COLORS: Record<EventStatus, string> = { PLANEJAMENTO: '#2d72a1', CONFIRMADO: '#278243', EM_ANDAMENTO: '#0d56bd', CONCLUIDO: '#7049b8', CANCELADO: '#c24c43' }
