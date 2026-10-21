import { describe, expect, it } from 'vitest'
import { MAX_PERIOD_DAYS, currentMonthRange, toApiPeriod, validatePeriod } from './reportPeriod'

describe('reportPeriod', () => {
  it('defaults to the first and last day of the current month', () => {
    expect(currentMonthRange(new Date(2026, 9, 21, 15, 30))).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(currentMonthRange(new Date(2028, 1, 10))).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(currentMonthRange(new Date(2026, 11, 31))).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })

  it('converts local calendar days to an inclusive ISO range (start of first day to end of last day)', () => {
    const { from, to } = toApiPeriod({ from: '2026-10-01', to: '2026-10-31' })

    expect(new Date(from).getTime()).toBe(new Date(2026, 9, 1, 0, 0, 0, 0).getTime())
    expect(new Date(to).getTime()).toBe(new Date(2026, 9, 31, 23, 59, 59, 999).getTime())
  })

  it('accepts a valid period', () => {
    expect(validatePeriod({ from: '2026-10-01', to: '2026-10-31' })).toBeNull()
    expect(validatePeriod({ from: '2026-10-01', to: '2026-10-01' })).toBeNull()
  })

  it('rejects empty dates, inverted periods and periods longer than the limit', () => {
    expect(validatePeriod({ from: '', to: '2026-10-31' })).toBe('Informe a data inicial e a data final.')
    expect(validatePeriod({ from: '2026-10-31', to: '2026-10-01' })).toBe('A data final deve ser igual ou posterior à data inicial.')
    expect(validatePeriod({ from: '2025-01-01', to: '2026-01-02' })).toBe(`O período deve ter no máximo ${MAX_PERIOD_DAYS} dias.`)
    expect(validatePeriod({ from: '2028-01-01', to: '2028-12-31' })).toBeNull()
  })
})
