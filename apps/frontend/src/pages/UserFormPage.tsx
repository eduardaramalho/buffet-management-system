import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createUser, getUser, updateUser } from '../api/usersApi'
import { listRoles } from '../api/rolesApi'
import { Button } from '../components/Button'
import { FormField } from '../components/FormField'
import { Notice } from '../components/Notice'

const MIN_PASSWORD_LENGTH = 8

export function UserFormPage() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    // Edição carrega o usuário; criação carrega os papéis disponíveis para o vínculo inicial.
    if (id) {
      void getUser(id)
        .then((user) => {
          setName(user.name)
          setEmail(user.email)
        })
        .catch((cause) => setError(cause instanceof Error ? cause.message : 'Falha ao carregar usuário'))
      return
    }
    void listRoles()
      .then((items) => setRoles(items))
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Falha ao carregar papéis'))
  }, [id])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      // ADR 0012: a edição não muda a senha; ela só muda pelo reset do administrador ou pela troca do próprio usuário.
      if (id) await updateUser(id, { name, email })
      else await createUser({ name, email, password, roleId })
      navigate('/users')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar usuário')
    }
  }

  return (
    <main className="auth-panel">
      <div className="form-wrap">
        <h2>{isEditing ? 'Editar usuário' : 'Novo usuário'}</h2>
        <form onSubmit={submit}>
          <FormField label="Nome" value={name} onChange={(event) => setName(event.target.value)} required />
          <FormField label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          {!isEditing && (
            <label>
              Papel
              <select value={roleId} onChange={(event) => setRoleId(event.target.value)} required>
                <option value="">Selecione um papel</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </label>
          )}
          {!isEditing && (
            <FormField
              label="Senha"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          )}
          {error && <Notice message={error} error />}
          <Button>Salvar</Button>
        </form>
        <Link className="link-button" to="/users">Cancelar</Link>
      </div>
    </main>
  )
}
