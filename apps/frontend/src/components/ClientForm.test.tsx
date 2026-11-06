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
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))

describe('ClientForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires the client name and shows the error next to the field', async () => {
    render(<ClientForm onClose={vi.fn()} onSaved={vi.fn()} />)

    save()

    expect(await screen.findByText('Informe o nome do cliente.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('masks CPF and phone while typing', () => {
    render(<ClientForm onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '52998224725' } })
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '47999990000' } })

    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25')
    expect(screen.getByLabelText('Telefone')).toHaveValue('(47) 99999-0000')
  })

  it('rejects an invalid CPF, e-mail or incomplete phone before calling the API', async () => {
    render(<ClientForm onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '52998224724' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@' } })
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '4799' } })
    save()

    expect(await screen.findByText('CPF inválido. Confira os números digitados.')).toBeInTheDocument()
    expect(screen.getByText('Informe um e-mail válido, por exemplo nome@empresa.com.')).toBeInTheDocument()
    expect(screen.getByText('Informe o telefone com DDD, por exemplo (47) 99999-0000.')).toBeInTheDocument()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('creates a PF client sending empty optional fields as null', async () => {
    vi.mocked(createClient).mockResolvedValue(client)
    const onSaved = vi.fn()
    render(<ClientForm onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: ' Ana Souza ' } })
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } })
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '47999990000' } })
    save()

    await waitFor(() => expect(createClient).toHaveBeenCalledWith({
      type: 'PF', name: 'Ana Souza', document: '529.982.247-25', email: null, phone: '(47) 99999-0000', notes: null,
    }))
    expect(onSaved).toHaveBeenCalledWith(client)
  })

  it('switches to company fields and the alphanumeric CNPJ mask', () => {
    render(<ClientForm onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pessoa jurídica' }))
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '12abc34501de35' } })

    expect(screen.getByRole('button', { name: 'Pessoa jurídica' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Razão social')).toBeInTheDocument()
    expect(screen.getByLabelText('CNPJ')).toHaveValue('12.ABC.345/01DE-35')
  })

  it('pre-fills a client with masked values and updates it', async () => {
    vi.mocked(updateClient).mockResolvedValue({ ...client, phone: '(47) 98888-0000' })
    const onSaved = vi.fn()
    render(<ClientForm client={client} onClose={vi.fn()} onSaved={onSaved} />)

    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25')
    expect(screen.getByLabelText('Telefone')).toHaveValue('(47) 99999-0000')
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '47988880000' } })
    save()

    await waitFor(() => expect(updateClient).toHaveBeenCalledWith('client-1', {
      type: 'PF', name: 'Ana Souza', document: '529.982.247-25', email: 'ana@email.com', phone: '(47) 98888-0000', notes: null,
    }))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ phone: '(47) 98888-0000' }))
  })

  it('pre-fills a company CNPJ', () => {
    render(<ClientForm client={{ ...client, type: 'PJ', document: '11222333000181' }} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByLabelText('CNPJ')).toHaveValue('11.222.333/0001-81')
  })

  it('shows the API message when saving fails', async () => {
    vi.mocked(createClient).mockRejectedValue(new Error('Já existe um cliente com este documento'))
    render(<ClientForm onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } })
    save()

    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um cliente com este documento')
  })
})
