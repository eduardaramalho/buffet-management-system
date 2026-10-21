import { useState, type FormEvent } from 'react'
import { createClient, updateClient } from '../api/clientsApi'
import { getApiErrorMessage } from '../api/apiError'
import { formatDocument } from '../utils/document'
import { Button } from './Button'
import { Notice } from './Notice'
import { CLIENT_TYPE_LABELS, CLIENT_TYPES, type Client, type ClientType } from '../types/client'

type ClientFormProps = { client?: Client; onClose: () => void; onSaved: (client: Client) => void }
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/
const optional = (value: string) => value.trim() || null

export function ClientForm({ client, onClose, onSaved }: ClientFormProps) {
  const [type, setType] = useState<ClientType>(client?.type ?? 'PF')
  const [name, setName] = useState(client?.name ?? '')
  const [documentNumber, setDocumentNumber] = useState(client?.document ? formatDocument(client.document) : '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isCompany = type === 'PJ'
  const title = client ? 'Editar cliente' : 'Novo cliente'

  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault(); setError('')
    if (!name.trim()) return setError('Informe o nome do cliente.')
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) return setError('Informe um e-mail válido.')
    setLoading(true)
    try {
      // The API normalizes and validates the document (check digits), so it is sent as typed.
      const input = { type, name: name.trim(), document: optional(documentNumber), email: optional(email), phone: optional(phone), notes: optional(notes) }
      onSaved(client ? await updateClient(client.id, input) : await createClient(input))
      onClose()
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível salvar o cliente')) } finally { setLoading(false) }
  }

  return <aside className="user-form-panel" role="dialog" aria-modal="true" aria-labelledby="client-form-title"><div className="form-wrap">
    <button type="button" className="link-button" onClick={onClose}>Voltar</button>
    <h2 id="client-form-title">{title}</h2>
    <form onSubmit={submit} noValidate>
      <label>Tipo de cliente<select aria-label="Tipo de cliente" value={type} onChange={(event) => setType(event.target.value as ClientType)}>{CLIENT_TYPES.map((value) => <option key={value} value={value}>{CLIENT_TYPE_LABELS[value]}</option>)}</select></label>
      <label>{isCompany ? 'Razão social' : 'Nome'}<input aria-label={isCompany ? 'Razão social' : 'Nome'} value={name} maxLength={150} onChange={(event) => setName(event.target.value)} /></label>
      <label>{isCompany ? 'CNPJ' : 'CPF'}<input aria-label={isCompany ? 'CNPJ' : 'CPF'} value={documentNumber} maxLength={18} placeholder="Opcional" onChange={(event) => setDocumentNumber(event.target.value)} /></label>
      <label>E-mail<input aria-label="E-mail" type="email" value={email} maxLength={150} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Telefone<input aria-label="Telefone" value={phone} maxLength={30} onChange={(event) => setPhone(event.target.value)} /></label>
      <label>Observações<textarea aria-label="Observações" value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} /></label>
      {error && <Notice message={error} error />}
      <div className="form-actions"><Button type="button" className="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" className="primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button></div>
    </form>
  </div></aside>
}
