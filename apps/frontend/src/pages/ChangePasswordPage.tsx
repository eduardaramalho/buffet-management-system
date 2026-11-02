import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../api/apiError'
import { Button } from '../components/Button'
import { FormField } from '../components/FormField'
import { Notice } from '../components/Notice'
import { useAuth } from '../contexts/useAuth'

const PASSWORD_MIN_LENGTH = 8

/** ADR 0012: troca obrigatória depois que o administrador redefine a senha. Fica fora do layout interno de propósito. */
export function ChangePasswordPage() {
  const { changePassword, logout, loading } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')

  const validate = () => {
    if (newPassword !== confirmation) return 'A confirmação não confere com a nova senha'
    if (newPassword === currentPassword) return 'A nova senha precisa ser diferente da atual'
    return ''
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const invalid = validate()
    setError(invalid)
    if (invalid) return
    try {
      await changePassword(currentPassword, newPassword)
      navigate('/', { replace: true })
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível trocar a senha')) }
  }

  return <main className="auth-panel">
    <div className="form-wrap">
      <span className="eyebrow">PRIMEIRO ACESSO</span>
      <h2>Defina uma nova senha</h2>
      <p className="muted">Você entrou com uma senha temporária gerada pelo administrador. Escolha uma senha pessoal para continuar.</p>
      <form onSubmit={submit}>
        <FormField label="Senha atual" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        <FormField label="Nova senha" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
        <FormField label="Confirmar nova senha" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
        {error && <Notice message={error} error />}
        <Button disabled={loading}>{loading ? 'Aguarde...' : 'Salvar nova senha'}</Button>
      </form>
      <button type="button" className="link-button" onClick={() => void logout()}>Sair</button>
    </div>
  </main>
}
