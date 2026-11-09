import { describe, expect, it } from 'vitest'
import { decideTaskDrop, getMoveBlockReason } from './taskBoard'

describe('decideTaskDrop (ADR 0014 aplicada ao arraste)', () => {
  it('ignores a drop on the column the task is already in', () => {
    expect(decideTaskDrop({ status: 'PENDENTE' }, 'PENDENTE')).toEqual({ kind: 'none' })
  })

  it.each([
    ['PENDENTE', 'EM_ANDAMENTO'],
    ['EM_ANDAMENTO', 'PENDENTE'],
    ['EM_ANDAMENTO', 'CONCLUIDA'],
  ] as const)('moves %s → %s directly', (from, to) => {
    expect(decideTaskDrop({ status: from }, to)).toEqual({ kind: 'move' })
  })

  it('asks for confirmation before cancelling, because it cannot be undone', () => {
    expect(decideTaskDrop({ status: 'PENDENTE' }, 'CANCELADA')).toEqual({ kind: 'confirm' })
    expect(decideTaskDrop({ status: 'EM_ANDAMENTO' }, 'CANCELADA')).toEqual({ kind: 'confirm' })
  })

  it('rejects Pendente → Concluída explaining the missing step', () => {
    expect(decideTaskDrop({ status: 'PENDENTE' }, 'CONCLUIDA')).toEqual({
      kind: 'reject',
      reason: 'Inicie a tarefa antes de concluir: mova primeiro para Em andamento.',
    })
  })

  it.each(['CONCLUIDA', 'CANCELADA'] as const)('rejects any move out of the terminal status %s', (status) => {
    expect(decideTaskDrop({ status }, 'PENDENTE')).toEqual({ kind: 'reject', reason: 'Tarefas concluídas ou canceladas não mudam mais de status.' })
  })

  it.each(['CONCLUIDO', 'CANCELADO'])('only lets an open task of a %s event be cancelled', (eventStatus) => {
    expect(decideTaskDrop({ status: 'EM_ANDAMENTO' }, 'CONCLUIDA', eventStatus)).toEqual({
      kind: 'reject',
      reason: 'O evento já foi encerrado: as tarefas abertas só podem ser canceladas.',
    })
    expect(decideTaskDrop({ status: 'EM_ANDAMENTO' }, 'CANCELADA', eventStatus)).toEqual({ kind: 'confirm' })
  })
})

describe('getMoveBlockReason', () => {
  it('returns null for an allowed move', () => {
    expect(getMoveBlockReason({ status: 'PENDENTE' }, 'EM_ANDAMENTO')).toBeNull()
  })

  it('returns null for the origin column', () => {
    expect(getMoveBlockReason({ status: 'PENDENTE' }, 'PENDENTE')).toBeNull()
  })
})
