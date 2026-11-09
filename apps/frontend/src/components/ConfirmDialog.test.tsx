import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  const renderDialog = () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog title="Cancelar a tarefa?" message="Essa ação não pode ser desfeita." confirmLabel="Cancelar tarefa" onConfirm={onConfirm} onCancel={onCancel} />)
    return { onConfirm, onCancel }
  }

  it('is an alert dialog that starts focused on the safe option', () => {
    renderDialog()

    expect(screen.getByRole('alertdialog', { name: 'Cancelar a tarefa?' })).toHaveTextContent('Essa ação não pode ser desfeita.')
    expect(screen.getByRole('button', { name: 'Voltar' })).toHaveFocus()
  })

  it('confirms and cancels', () => {
    const { onConfirm, onCancel } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar tarefa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancels with Escape', () => {
    const { onCancel } = renderDialog()

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })

    expect(onCancel).toHaveBeenCalled()
  })
})
