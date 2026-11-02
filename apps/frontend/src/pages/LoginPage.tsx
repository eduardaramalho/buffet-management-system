import { useState, type FormEvent } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { Button } from '../components/Button'
import { FormField } from '../components/FormField'
import { Notice } from '../components/Notice'
import { useAuth } from '../contexts/useAuth'
import { Logo } from '../components/Logo'

export function LoginPage() {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); try { await login(email, password) } catch (cause) { setError(getApiErrorMessage(cause, 'Falha no login')) } }
  return <main className="auth-shell"><section className="auth-art"><Logo /><h1>Organize. Planeje. Execute.</h1><p>Sistema web para gestão de serviços e planejamento operacional de eventos.</p><div className="art-line" /><div className="table-illustration" /></section><section className="auth-panel"><div className="form-wrap"><h2>Acesse sua conta</h2><p className="muted">Informe seu e-mail e senha para entrar no sistema.</p><form onSubmit={submit}><FormField label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><FormField label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /><p className="muted">Esqueceu a senha? Procure o administrador do sistema.</p>{error && <Notice message={error} error /> }<Button disabled={loading}>{loading ? 'Aguarde...' : 'Entrar'}</Button></form></div></section></main>
}