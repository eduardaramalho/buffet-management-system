import { useState, type FormEvent } from 'react'
import { getApiErrorCode, getApiErrorMessage } from '../api/apiError'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { FormField } from '../components/FormField'
import { Icon, type IconName } from '../components/Icon'
import { Notice } from '../components/Notice'
import { PasswordField } from '../components/PasswordField'
import { useAuth } from '../contexts/useAuth'

const TEMP_PASSWORD_EXPIRED = 'TEMP_PASSWORD_EXPIRED'

const highlights: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'bolt', title: 'Tarefas geradas por regras', text: 'O motor de regras monta o checklist de cada evento.' },
  { icon: 'calendar', title: 'Central do evento', text: 'Equipes, tarefas e histórico na mesma tela.' },
  { icon: 'chart', title: 'Dashboard e relatórios', text: 'Indicadores para o gestor acompanhar a operação.' },
]

type LoginError = { message: string; expired: boolean }

export function LoginPage() {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<LoginError | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try { await login(email, password) }
    catch (cause) { setError({ message: getApiErrorMessage(cause, 'Falha no login'), expired: getApiErrorCode(cause) === TEMP_PASSWORD_EXPIRED }) }
  }

  const aside = <ul className="auth-highlights">{highlights.map((item) => <li key={item.title}>
    <span className="auth-highlight-icon"><Icon name={item.icon} /></span>
    <span><strong>{item.title}</strong><span>{item.text}</span></span>
  </li>)}</ul>

  const helpToggle = <button type="button" className="link-button" aria-expanded={helpOpen} aria-controls="password-help" onClick={() => setHelpOpen((open) => !open)}>Esqueceu a senha?</button>

  return <AuthLayout title="Organize. Planeje. Execute." description="Planejamento operacional de eventos de buffet em um só lugar, do cadastro ao relatório final." aside={aside}>
    <span className="eyebrow">Acesso ao sistema</span>
    <h1>Acesse sua conta</h1>
    <p className="muted">Informe seu e-mail e senha para entrar no EventosPro.</p>
    {error && <Notice message={error.message} error={!error.expired} warning={error.expired} />}
    <form onSubmit={submit}>
      <FormField label="E-mail" type="email" icon="mail" autoComplete="username" placeholder="nome@empresa.com.br" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <PasswordField id="login-password" label="Senha" icon="lock" autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(event) => setPassword(event.target.value)} required action={helpToggle} />
      {helpOpen && <div id="password-help" className="auth-help" role="region" aria-label="Como recuperar a senha">
        <span className="auth-help-icon"><Icon name="shield" /></span>
        <span><strong>Procure o administrador do sistema</strong><span>Ele gera uma senha temporária, válida por 24 horas. Ao entrar com ela, você define uma senha pessoal.</span></span>
      </div>}
      <Button className="auth-submit" disabled={loading}>{loading ? <><span className="spinner" aria-hidden="true" />Entrando...</> : 'Entrar'}</Button>
    </form>
    <p className="auth-note"><Icon name="key" />Primeiro acesso? Entre com a senha temporária fornecida pelo administrador. Você vai definir uma senha pessoal em seguida.</p>
  </AuthLayout>
}
