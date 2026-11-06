import { useState } from 'react'
import { createClient, updateClient } from '../api/clientsApi'
import { getApiErrorMessage } from '../api/apiError'
import { useToast } from '../contexts/toast'
import { useFormValidation } from '../hooks/useFormValidation'
import { maskCnpj, maskCpf, maskPhone } from '../utils/masks'
import { clientFormSchema } from '../validation/clientSchema'
import { Icon } from './Icon'
import { FormModal } from './form/FormModal'
import { MaskedField } from './form/MaskedField'
import { SegmentedControl } from './form/SegmentedControl'
import { TextAreaField, TextField } from './form/TextField'
import { CLIENT_TYPE_LABELS, CLIENT_TYPES, type Client, type ClientType } from '../types/client'

type ClientFormProps = { client?: Client; onClose: () => void; onSaved: (client: Client) => void }
const optional = (value: string) => value.trim() || null
const TYPE_OPTIONS = CLIENT_TYPES.map((value) => ({ value, label: CLIENT_TYPE_LABELS[value] }))

export function ClientForm({ client, onClose, onSaved }: ClientFormProps) {
  const toast = useToast()
  const [type, setType] = useState<ClientType>(client?.type ?? 'PF')
  const [name, setName] = useState(client?.name ?? '')
  const [documentNumber, setDocumentNumber] = useState(() => {
    if (!client?.document) return ''
    return client.type === 'PJ' ? maskCnpj(client.document) : maskCpf(client.document)
  })
  const [email, setEmail] = useState(client?.email ?? '')
  const [phone, setPhone] = useState(client?.phone ? maskPhone(client.phone) : '')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const validation = useFormValidation(clientFormSchema, { type, name, document: documentNumber, email, phone, notes })
  const isCompany = type === 'PJ'

  // Trocar o tipo reaplica a máscara: um CPF digitado não vira CNPJ pela metade.
  const changeType = (next: ClientType) => {
    setType(next)
    setDocumentNumber((current) => (next === 'PJ' ? maskCnpj(current) : maskCpf(current)))
  }

  const submit = async () => {
    setApiError('')
    if (!validation.submit()) return
    setSubmitting(true)
    try {
      // The API normalizes the document (removes punctuation) and checks it again, so it is sent as typed.
      const input = { type, name: name.trim(), document: optional(documentNumber), email: optional(email), phone: optional(phone), notes: optional(notes) }
      const saved = client ? await updateClient(client.id, input) : await createClient(input)
      toast.success(client ? 'Cliente atualizado.' : 'Cliente cadastrado.')
      onSaved(saved)
      onClose()
    } catch (cause) { setApiError(getApiErrorMessage(cause, 'Não foi possível salvar o cliente')) } finally { setSubmitting(false) }
  }

  return <FormModal title={client ? 'Editar cliente' : 'Novo cliente'} subtitle="Pessoa ou empresa que contrata o evento." icon={<Icon name="user" />}
    onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel="Salvar cliente" error={apiError} invalidAttempt={validation.invalidAttempt}>
    <SegmentedControl label="Tipo de cliente" value={type} options={TYPE_OPTIONS} onChange={changeType} />
    <div className="fm-row">
      <TextField label={isCompany ? 'Razão social' : 'Nome'} required value={name} maxLength={150} error={validation.errorFor('name')}
        onChange={(event) => setName(event.target.value)} onBlur={(event) => validation.touch('name', event)} />
      <MaskedField label={isCompany ? 'CNPJ' : 'CPF'} optional value={documentNumber} mask={isCompany ? maskCnpj : maskCpf}
        placeholder={isCompany ? '00.000.000/0000-00' : '000.000.000-00'} inputMode={isCompany ? 'text' : 'numeric'} error={validation.errorFor('document')}
        onValueChange={setDocumentNumber} onBlur={(event) => validation.touch('document', event)} />
    </div>
    <div className="fm-row">
      <TextField label="E-mail" optional type="email" value={email} maxLength={150} placeholder="nome@empresa.com" error={validation.errorFor('email')}
        onChange={(event) => setEmail(event.target.value)} onBlur={(event) => validation.touch('email', event)} />
      <MaskedField label="Telefone" optional value={phone} mask={maskPhone} placeholder="(47) 99999-9999" inputMode="tel" error={validation.errorFor('phone')}
        onValueChange={setPhone} onBlur={(event) => validation.touch('phone', event)} />
    </div>
    <TextAreaField label="Observações" optional value={notes} maxLength={2000} error={validation.errorFor('notes')}
      onChange={(event) => setNotes(event.target.value)} onBlur={(event) => validation.touch('notes', event)} />
  </FormModal>
}
