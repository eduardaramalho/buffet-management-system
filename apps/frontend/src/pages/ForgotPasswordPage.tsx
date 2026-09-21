import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/authApi'
import { Button } from '../components/Button'
import { FormField } from '../components/FormField'
import { Notice } from '../components/Notice'

export function ForgotPasswordPage() { const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); try { await forgotPassword(email); setMessage('Se o e-mail existir, as instruções foram enviadas.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha na solicitação') } }; return <main className="auth-panel"><div className="form-wrap"><span className="eyebrow">RECUPERAÇÃO</span><h2>Recupere seu acesso</h2><p className="muted">Enviaremos instruções para o seu e-mail.</p><form onSubmit={submit}><FormField label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />{error && <Notice message={error} error />}{message && <Notice message={message} />}<Button>Enviar instruções</Button></form><Link className="link-button" to="/login">Voltar para o login</Link></div></main> }