import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../api/apiError'
import { AuthLayout } from '../components/AuthLayout'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { Notice } from '../components/Notice'
import { PasswordField } from '../components/PasswordField'
import { useAuth } from '../contexts/useAuth'

const PASSWORD_MIN_LENGTH = 8

/** ADR 0012: troca obrigatória depois que o administrador redefine a senha. Fica fora do layout interno de propósito. */
export function ChangePasswordPage() {
  const { user, changePassword, logout, loading } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')

  // Mesmas regras do validate(): o checklist só mostra antes do envio o que o envio vai conferir.
  const requirements = [
    { label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`, met: newPassword.length >= PASSWORD_MIN_LENGTH },
    { label: 'Diferente da senha temporária', met: newPassword.length > 0 && newPassword !== currentPassword },
    { label: 'As duas senhas são iguais', met: newPassword.length > 0 && newPassword === confirmation },
  ]

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

  const account = user && <div className="auth-account">
    <Avatar name={user.name} />
    <span><strong>{user.name}</strong><small>{user.email}</small></span>
  </div>

  return <AuthLayout title="Falta só um passo." description="Você entrou com a senha temporária gerada pelo administrador. Defina uma senha pessoal para liberar o acesso ao sistema." aside={account}>
    <span className="eyebrow">Primeiro acesso</span>
    <h1>Defina uma nova senha</h1>
    <p className="muted">Ao salvar, as sessões abertas em outros dispositivos são encerradas.</p>
    <form onSubmit={submit}>
      <PasswordField id="current-password" label="Senha temporária" hint="A senha que o administrador informou para você." autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
      <PasswordField id="new-password" label="Nova senha" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
      <PasswordField id="password-confirmation" label="Confirmar nova senha" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
      <ul className="password-requirements" aria-label="Requisitos da nova senha">
        {requirements.map((requirement) => <li key={requirement.label} className={requirement.met ? 'met' : undefined}>
          <span className="requirement-mark"><Icon name="check" /></span>
          <span className="sr-only">{requirement.met ? 'Atendido: ' : 'Pendente: '}</span>{requirement.label}
        </li>)}
      </ul>
      {error && <Notice message={error} error />}
      <Button className="auth-submit" disabled={loading}>{loading ? <><span className="spinner" aria-hidden="true" />Salvando...</> : 'Salvar nova senha'}</Button>
    </form>
    <div className="auth-footer-actions">
      <span className="muted">Não é você?</span>
      <button type="button" className="secondary outline" onClick={() => void logout()}><Icon name="logout" />Sair</button>
    </div>
  </AuthLayout>
}
