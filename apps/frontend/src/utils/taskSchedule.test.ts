import { describe, expect, it } from 'vitest'
import { isTaskOverdue } from './taskSchedule'

const now = new Date('2026-11-03T12:00:00.000Z')

describe('isTaskOverdue', () => {
  it.each(['PENDENTE', 'EM_ANDAMENTO'] as const)('flags an open %s task past its deadline', (status) => {
    expect(isTaskOverdue({ status, dueDate: '2026-11-03T11:59:00.000Z' }, now)).toBe(true)
  })

  it('does not flag tasks within the deadline, without a deadline, or already closed', () => {
    expect(isTaskOverdue({ status: 'PENDENTE', dueDate: '2026-11-03T12:00:00.000Z' }, now)).toBe(false)
    expect(isTaskOverdue({ status: 'PENDENTE', dueDate: null }, now)).toBe(false)
    expect(isTaskOverdue({ status: 'CONCLUIDA', dueDate: '2026-11-01T00:00:00.000Z' }, now)).toBe(false)
    expect(isTaskOverdue({ status: 'CANCELADA', dueDate: '2026-11-01T00:00:00.000Z' }, now)).toBe(false)
  })

  it('uses the current time by default', () => {
    expect(isTaskOverdue({ status: 'PENDENTE', dueDate: '2000-01-01T00:00:00.000Z' })).toBe(true)
  })
})
