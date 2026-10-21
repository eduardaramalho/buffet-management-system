const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export const formatDateTime = (value: string | null) => (value ? dateTime.format(new Date(value)) : '-')
export const formatPercentage = (value: number | null) => (value === null ? 'Sem dados' : `${decimal.format(value)}%`)
export const formatMinutes = (value: number | null) => (value === null ? 'Sem dados' : `${decimal.format(value)} min`)
