import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ServiceForm } from './ServiceForm'
import { createService, updateService } from '../api/servicesApi'
import type { Service } from '../types/event'

vi.mock('../api/servicesApi', () => ({ createService: vi.fn(), updateService: vi.fn() }))

const bar: Service = { id: 'service-bar', name: 'Bar', isCustom: false, createdAt: '', deletedAt: null }
const outro: Service = { id: 'service-outro', name: 'Outro', isCustom: true, createdAt: '', deletedAt: null }

describe('ServiceForm (RF06)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a service with the trimmed name and hands it over', async () => {
    vi.mocked(createService).mockResolvedValue(bar)
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<ServiceForm onClose={onClose} onSaved={onSaved} />)

    expect(screen.getByRole('dialog', { name: 'Novo serviço' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nome do serviço'), { target: { value: '  Bar  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar serviço' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(bar))
    expect(createService).toHaveBeenCalledWith('Bar')
    expect(onClose).toHaveBeenCalled()
  })

  it('marks the name as required and shows the error next to it', async () => {
    render(<ServiceForm onClose={vi.fn()} onSaved={vi.fn()} />)

    const input = screen.getByLabelText('Nome do serviço')
    expect(input).toHaveAttribute('aria-required', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar serviço' }))

    expect(await screen.findByText('Informe o nome do serviço.')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Informe o nome do serviço.'))
    expect(input).toHaveFocus()
    expect(createService).not.toHaveBeenCalled()
  })

  it('counts the characters against the API limit', () => {
    render(<ServiceForm onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nome do serviço'), { target: { value: 'Bar' } })
    expect(screen.getByText('3/100')).toBeInTheDocument()
  })

  it('renames an existing service', async () => {
    vi.mocked(updateService).mockResolvedValue({ ...bar, name: 'Bar premium' })
    const onSaved = vi.fn()
    render(<ServiceForm service={bar} onClose={vi.fn()} onSaved={onSaved} />)

    expect(screen.getByRole('dialog', { name: 'Editar serviço' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome do serviço')).toHaveValue('Bar')
    fireEvent.change(screen.getByLabelText('Nome do serviço'), { target: { value: 'Bar premium' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar serviço' }))

    await waitFor(() => expect(updateService).toHaveBeenCalledWith('service-bar', 'Bar premium'))
    expect(onSaved).toHaveBeenCalledWith({ ...bar, name: 'Bar premium' })
  })

  it('explains the generic service when editing it', () => {
    render(<ServiceForm service={outro} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByText(/Serviço genérico: ao contratá-lo, o evento informa um rótulo livre/)).toBeInTheDocument()
  })

  it('shows the API message, such as a duplicated name, and stays open', async () => {
    vi.mocked(createService).mockRejectedValue(new Error('Já existe um serviço com este nome'))
    const onClose = vi.fn()
    render(<ServiceForm onClose={onClose} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Nome do serviço'), { target: { value: 'Bar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar serviço' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um serviço com este nome')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on cancel and on the close button', () => {
    const onClose = vi.fn()
    render(<ServiceForm onClose={onClose} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
