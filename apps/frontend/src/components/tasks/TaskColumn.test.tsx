import { DndContext } from '@dnd-kit/core'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { TaskColumn, type ColumnDropState } from './TaskColumn'

const renderColumn = ({ count = 1, dropState = 'idle', blockedReason, children = <article>Montar mesas</article> }: { count?: number; dropState?: ColumnDropState; blockedReason?: string; children?: ReactNode } = {}) =>
  render(<DndContext><TaskColumn status="PENDENTE" count={count} dropState={dropState} blockedReason={blockedReason}>{children}</TaskColumn></DndContext>)

const column = () => screen.getByRole('region', { name: 'Pendente' })
const body = () => column().querySelector('.task-column-body') as HTMLElement

describe('TaskColumn (KAN-95: rolagem dentro da coluna)', () => {
  it('mantém o título e o contador fora da área que rola', () => {
    renderColumn({ count: 3 })
    const title = within(column()).getByRole('heading', { name: /Pendente/ })
    expect(title).toHaveTextContent('3')
    expect(body()).toBeInTheDocument()
    expect(body()).not.toContainElement(title)
  })

  it('coloca os cards dentro da área que rola', () => {
    renderColumn()
    expect(body()).toContainElement(screen.getByText('Montar mesas'))
  })

  it('mostra o aviso de coluna vazia dentro da área que rola', () => {
    renderColumn({ count: 0, children: null })
    expect(body()).toContainElement(screen.getByText('Nenhuma tarefa.'))
  })

  it('mantém a dica de destino visível acima dos cards durante o arraste', () => {
    renderColumn({ dropState: 'allowed' })
    const hint = screen.getByText('Solte aqui para mover')
    expect(body()).not.toContainElement(hint)
  })

  it('mostra o motivo da recusa fora da área que rola', () => {
    renderColumn({ dropState: 'blocked', blockedReason: 'Não é possível pular etapas' })
    expect(body()).not.toContainElement(screen.getByText('Não é possível pular etapas'))
  })
})
