import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FormModal } from './FormModal'
import { TextField } from './TextField'

function SimpleModal({ onClose = vi.fn(), onSubmit = vi.fn(), submitting = false, error }: { onClose?: () => void; onSubmit?: () => void; submitting?: boolean; error?: string }) {
  return <FormModal title="Novo item" subtitle="Descrição" icon="X" onClose={onClose} onSubmit={onSubmit} submitting={submitting} submitLabel="Salvar item" error={error}>
    <TextField label="Nome" required />
    <TextField label="Apelido" optional />
  </FormModal>
}

function SectionedModal({ onSubmit = vi.fn() }: { onSubmit?: () => void }) {
  const [section, setSection] = useState('a')
  return <FormModal title="Com seções" icon="X" onClose={vi.fn()} onSubmit={onSubmit} submitting={false} submitLabel="Salvar"
    activeSection={section} onSectionChange={setSection} railFooter={<p>Resumo</p>}
    sections={[{ id: 'a', label: 'Primeira', description: 'Dados', complete: true }, { id: 'b', label: 'Segunda', invalid: true }]}>
    <section hidden={section !== 'a'}><TextField label="Campo A" /></section>
    <section hidden={section !== 'b'}><TextField label="Campo B" /></section>
  </FormModal>
}

describe('FormModal', () => {
  it('is a labelled modal dialog that focuses the first field', () => {
    render(<SimpleModal />)

    const dialog = screen.getByRole('dialog', { name: 'Novo item' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Nome')).toHaveFocus()
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-required', 'true')
    expect(screen.getByText('(opcional)')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('submits with Enter and closes with Escape', async () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(<SimpleModal onSubmit={onSubmit} onClose={onClose} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Bolo{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps Tab inside the dialog in both directions', async () => {
    render(<SimpleModal />)
    const close = screen.getByRole('button', { name: 'Fechar' })
    const save = screen.getByRole('button', { name: 'Salvar item' })

    save.focus()
    await userEvent.tab()
    expect(close).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(save).toHaveFocus()
  })

  it('disables the actions and shows the loading state while saving', () => {
    const onClose = vi.fn()
    render(<SimpleModal submitting onClose={onClose} />)

    const save = screen.getByRole('button', { name: 'Salvando...' })
    expect(save).toBeDisabled()
    expect(save).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the API error as an alert and returns the focus to the opener when closed', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = render(<SimpleModal error="Falha ao salvar" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao salvar')
    act(() => unmount())
    expect(opener).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
    opener.remove()
  })

  it('navigates between sections, keeping Cancel and Save in place', () => {
    render(<SectionedModal />)

    expect(screen.getByText('Seção 1 de 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Seção anterior' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Primeira/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Segunda/ })).toHaveTextContent('contém erros')
    expect(screen.getByText('Resumo')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Próxima seção' }))
    expect(screen.getByText('Seção 2 de 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Campo B')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Próxima seção' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seção anterior' }))
    expect(screen.getByLabelText('Campo A')).toHaveFocus()
    const actions = screen.getAllByRole('button').slice(-2).map((button) => button.textContent)
    expect(actions).toEqual(['Cancelar', 'Salvar'])
  })
})
