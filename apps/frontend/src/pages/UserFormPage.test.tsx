import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserFormPage } from './UserFormPage'

const { createUser, getUser, updateUser, listRoles } = vi.hoisted(() => ({ createUser: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), listRoles: vi.fn() }))
vi.mock('../api/usersApi', () => ({ createUser, getUser, updateUser }))
vi.mock('../api/rolesApi', () => ({ listRoles }))

describe('UserFormPage', () => {
  const renderAt = (url: string) => render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/users/new" element={<UserFormPage />} />
        <Route path="/users/:id/edit" element={<UserFormPage />} />
        <Route path="/users" element={<p>Lista de usuários</p>} />
      </Routes>
    </MemoryRouter>,
  )

  beforeEach(() => {
    vi.clearAllMocks()
    listRoles.mockResolvedValue([{ id: 'r1', name: 'Gestor' }])
  })

  describe('criação', () => {
    it('carrega os papéis, cria o usuário com o papel escolhido e volta para a lista', async () => {
      createUser.mockResolvedValue({ id: 'u1' })
      renderAt('/users/new')

      expect(screen.getByRole('heading', { name: 'Novo usuário' })).toBeInTheDocument()
      await screen.findByRole('option', { name: 'Gestor' })
      await userEvent.type(screen.getByLabelText('Nome'), 'Ana')
      await userEvent.type(screen.getByLabelText('E-mail'), 'ana@buffet.com')
      await userEvent.selectOptions(screen.getByLabelText('Papel'), 'r1')
      await userEvent.type(screen.getByLabelText('Senha'), 'secret123')
      await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

      expect(createUser).toHaveBeenCalledWith({ name: 'Ana', email: 'ana@buffet.com', password: 'secret123', roleId: 'r1' })
      expect(await screen.findByText('Lista de usuários')).toBeInTheDocument()
    })

    it('exige senha de no mínimo 8 caracteres', async () => {
      renderAt('/users/new')

      expect(screen.getByLabelText('Senha')).toBeRequired()
      expect(screen.getByLabelText('Senha')).toHaveAttribute('minLength', '8')
    })

    it('mostra erro quando os papéis não carregam', async () => {
      listRoles.mockRejectedValue(new Error('Sem permissão'))
      renderAt('/users/new')

      expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão')
    })

    it('usa mensagem padrão quando os papéis falham sem Error', async () => {
      listRoles.mockRejectedValue('x')
      renderAt('/users/new')

      expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao carregar papéis')
    })

    it('mostra o erro e permanece no formulário quando salvar falha', async () => {
      createUser.mockRejectedValue(new Error('E-mail já cadastrado'))
      renderAt('/users/new')

      await screen.findByRole('option', { name: 'Gestor' })
      await userEvent.type(screen.getByLabelText('Nome'), 'Ana')
      await userEvent.type(screen.getByLabelText('E-mail'), 'ana@buffet.com')
      await userEvent.selectOptions(screen.getByLabelText('Papel'), 'r1')
      await userEvent.type(screen.getByLabelText('Senha'), 'secret123')
      await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('E-mail já cadastrado')
      expect(screen.queryByText('Lista de usuários')).not.toBeInTheDocument()
    })
  })

  describe('edição', () => {
    it('carrega os dados, não exibe papel, senha é opcional e não é enviada vazia', async () => {
      getUser.mockResolvedValue({ id: 'u1', name: 'Ana', email: 'ana@buffet.com' })
      updateUser.mockResolvedValue({ id: 'u1' })
      renderAt('/users/u1/edit')

      expect(screen.getByRole('heading', { name: 'Editar usuário' })).toBeInTheDocument()
      expect(await screen.findByDisplayValue('Ana')).toBeInTheDocument()
      expect(screen.queryByLabelText('Papel')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Senha')).not.toBeRequired()
      expect(listRoles).not.toHaveBeenCalled()

      await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

      expect(updateUser).toHaveBeenCalledWith('u1', { name: 'Ana', email: 'ana@buffet.com' })
      expect(await screen.findByText('Lista de usuários')).toBeInTheDocument()
    })

    it('envia a nova senha quando preenchida', async () => {
      getUser.mockResolvedValue({ id: 'u1', name: 'Ana', email: 'ana@buffet.com' })
      updateUser.mockResolvedValue({ id: 'u1' })
      renderAt('/users/u1/edit')

      await screen.findByDisplayValue('Ana')
      await userEvent.type(screen.getByLabelText('Senha'), 'outraSenha1')
      await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

      expect(updateUser).toHaveBeenCalledWith('u1', { name: 'Ana', email: 'ana@buffet.com', password: 'outraSenha1' })
    })

    it('mostra erro quando o usuário não carrega', async () => {
      getUser.mockRejectedValue(new Error('Usuário não encontrado'))
      renderAt('/users/u404/edit')

      expect(await screen.findByRole('alert')).toHaveTextContent('Usuário não encontrado')
    })

    it('usa mensagens padrão quando falhas não são Error', async () => {
      getUser.mockRejectedValue('x')
      renderAt('/users/u1/edit')

      expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao carregar usuário')
    })

    it('usa mensagem padrão quando salvar falha sem Error', async () => {
      getUser.mockResolvedValue({ id: 'u1', name: 'Ana', email: 'ana@buffet.com' })
      updateUser.mockRejectedValue('x')
      renderAt('/users/u1/edit')

      await screen.findByDisplayValue('Ana')
      await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao salvar usuário')
    })
  })
})
