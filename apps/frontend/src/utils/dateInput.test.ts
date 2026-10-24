import { describe, expect, it } from 'vitest'
import { fromDateInput, toDateInput } from './dateInput'

// <input type="datetime-local"> works in local time; toISOString() alone would shift the value to UTC.
describe('dateInput', () => {
  it('formats an ISO date as a local datetime-local value', () => {
    const iso = new Date(2026, 11, 5, 9, 30).toISOString()

    expect(toDateInput(iso)).toBe('2026-12-05T09:30')
    expect(toDateInput(null)).toBe('')
    expect(toDateInput(undefined)).toBe('')
  })

  it('converts a datetime-local value back to ISO and an empty value to null', () => {
    expect(fromDateInput('2026-12-05T09:30')).toBe(new Date(2026, 11, 5, 9, 30).toISOString())
    expect(fromDateInput('')).toBeNull()
  })
})
