import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientForm } from './ClientForm'
import { createClient, updateClient } from '../api/clientsApi'
import type { Client } from '../types/client'

vi.mock('../api/clientsApi', () => ({ createClient: vi.fn(), updateClient: vi.fn() }))

const client: Client = {
  id: 'client-1', type: 'PF', name: 'Ana Souza', document: '52998224725', email: 'ana@email.com', phone: '47999990000',
  notes: null, createdAt: '', updatedAt: '', deletedAt: null,
}

describe('ClientForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires the client name', async () => {
    render(<ClientForm onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Informe o nome do cliente.')).toBeInTheDocument()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('creates a PF client sending empty optional fields as null', async () => {
    vi.mocked(createClient).mockResolvedValue(client)
    const onSaved = vi.fn()
    render(<ClientForm onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: ' Ana Souza ' } })
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } })
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '47999990000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(createClient).toHaveBeenCalledWith({
      type: 'PF', name: 'Ana Souza', document: '529.982.247-25', email: null, phone: '47999990000', notes: null,
    }))
    expect(onSaved).toHaveBeenCalledWith(client)
  })

  it('switches the document label to CNPJ for a PJ client', () => {
    render(<ClientForm onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Tipo de cliente'), { target: { value: 'PJ' } })

    expect(screen.getByLabelText('CNPJ')).toBeInTheDocument()
    expect(screen.getByLabelText('Razão social')).toBeInTheDocument()
  })

  it('pre-fills and updates an existing client', async () => {
    vi.mocked(updateClient).mockResolvedValue({ ...client, phone: '47888880000' })
    const onSaved = vi.fn()
    render(<ClientForm client={client} onClose={vi.fn()} onSaved={onSaved} />)

    expect(screen.getByDisplayValue('529.982.247-25')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '47888880000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(updateClient).toHaveBeenCalledWith('client-1', {
      type: 'PF', name: 'Ana Souza', document: '529.982.247-25', email: 'ana@email.com', phone: '47888880000', notes: null,
    }))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ phone: '47888880000' }))
  })

  it('shows the API message when saving fails', async () => {
    vi.mocked(createClient).mockRejectedValue(new Error('Já existe um cliente com este documento'))
    render(<ClientForm onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Já existe um cliente com este documento')).toBeInTheDocument()
  })
})
