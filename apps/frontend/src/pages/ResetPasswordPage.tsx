import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { resetPassword } from '../api/authApi'
import { Button } from '../components/Button'
import { FormField } from '../components/FormField'
import { Notice } from '../components/Notice'

export function ResetPasswordPage() { const [params] = useSearchParams(); const navigate = useNavigate(); const [password, setPassword] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const submit = async (event: FormEvent) => { event.preventDefault(); try { await resetPassword(params.get('token') ?? '', password); setMessage('Senha redefinida com sucesso.'); setTimeout(() => navigate('/login'), 500) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao redefinir senha') } }; return <main className="auth-panel"><div className="form-wrap"><h2>Redefina sua senha</h2><form onSubmit={submit}><FormField label="Nova senha" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />{error && <Notice message={error} error />}{message && <Notice message={message} />}<Button>Redefinir senha</Button></form><Link className="link-button" to="/login">Voltar</Link></div></main> }