import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/authApi'
import { Button } from '../components/Button'
import { FormField } from '../components/FormField'
import { Notice } from '../components/Notice'

const REDIRECT_DELAY_MS = 500

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      // Sem token na URL, envia vazio e deixa o backend recusar com a mensagem adequada.
      await resetPassword(params.get('token') ?? '', password)
      setMessage('Senha redefinida com sucesso.')
      setTimeout(() => navigate('/login'), REDIRECT_DELAY_MS)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao redefinir senha')
    }
  }

  return (
    <main className="auth-panel">
      <div className="form-wrap">
        <h2>Redefina sua senha</h2>
        <form onSubmit={submit}>
          <FormField label="Nova senha" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error && <Notice message={error} error />}
          {message && <Notice message={message} />}
          <Button>Redefinir senha</Button>
        </form>
        <Link className="link-button" to="/login">Voltar</Link>
      </div>
    </main>
  )
}
