// Same limit enforced by the API (422 when exceeded); validating here gives a friendly message first.
export const MAX_PERIOD_DAYS = 366
const MAX_PERIOD_MS = MAX_PERIOD_DAYS * 24 * 60 * 60 * 1000

/** Calendar days as typed in <input type="date"> (yyyy-MM-dd, local time). */
export type PeriodInput = { from: string; to: string }
export type ApiPeriod = { from: string; to: string }

const pad = (value: number) => String(value).padStart(2, '0')
const toInputDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

function parseInputDate(value: string, endOfDay: boolean): Date {
  const [year, month, day] = value.split('-').map(Number)
  return endOfDay ? new Date(year, month - 1, day, 23, 59, 59, 999) : new Date(year, month - 1, day, 0, 0, 0, 0)
}

export function currentMonthRange(today: Date = new Date()): PeriodInput {
  return {
    from: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  }
}

/** Inclusive range in the user's local time zone: start of the first day to the end of the last day. */
export function toApiPeriod(period: PeriodInput): ApiPeriod {
  return { from: parseInputDate(period.from, false).toISOString(), to: parseInputDate(period.to, true).toISOString() }
}

export function validatePeriod(period: PeriodInput): string | null {
  if (!period.from || !period.to) return 'Informe a data inicial e a data final.'
  const span = parseInputDate(period.to, true).getTime() - parseInputDate(period.from, false).getTime()
  if (span < 0) return 'A data final deve ser igual ou posterior à data inicial.'
  if (span > MAX_PERIOD_MS) return `O período deve ter no máximo ${MAX_PERIOD_DAYS} dias.`
  return null
}
