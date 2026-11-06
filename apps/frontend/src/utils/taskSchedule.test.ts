import { describe, expect, it } from 'vitest'
import { isTaskOverdue, sortTasksBySchedule } from './taskSchedule'

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

describe('sortTasksBySchedule', () => {
  it('orders by deadline, puts tasks without a deadline last and keeps the creation order on ties', () => {
    const tasks = [
      { id: 'sem-prazo', dueDate: null, createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 'depois', dueDate: '2026-11-10T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 'empate-2', dueDate: '2026-11-05T00:00:00.000Z', createdAt: '2026-10-02T00:00:00.000Z' },
      { id: 'empate-1', dueDate: '2026-11-05T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z' },
    ]

    expect(sortTasksBySchedule(tasks).map((task) => task.id)).toEqual(['empate-1', 'empate-2', 'depois', 'sem-prazo'])
    expect(tasks[0].id).toBe('sem-prazo')
  })
})
