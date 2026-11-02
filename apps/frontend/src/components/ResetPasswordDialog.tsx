import { useState } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { resetUserPassword } from '../api/usersApi'
import { Icon } from './Icon'
import { Notice } from './Notice'
import type { TemporaryPassword, User } from '../types'

/**
 * ADR 0012: o administrador gera uma senha temporária e a repassa ao usuário. A senha aparece só aqui,
 * uma única vez: o backend não a guarda em texto e não há como consultá-la depois.
 */
export function ResetPasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [result, setResult] = useState<TemporaryPassword | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const reset = async () => {
    setError('')
    setLoading(true)
    try { setResult(await resetUserPassword(user.id)) }
    catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível redefinir a senha')) }
    finally { setLoading(false) }
  }

  const copy = async () => {
    if (!result) return
    try { await navigator.clipboard.writeText(result.temporaryPassword); setCopied(true) }
    catch { setError('Não foi possível copiar. Selecione a senha e copie manualmente.') }
  }

  return <aside className="user-form-panel" role="dialog" aria-modal="true" aria-labelledby="reset-password-title">
    <div className="form-wrap">
      <h2 id="reset-password-title">Redefinir senha</h2>
      {!result ? <>
        <p>Gerar uma senha temporária para <strong>{user.name}</strong> ({user.email})?</p>
        <p className="muted">A senha atual deixa de funcionar e as sessões abertas são encerradas. No próximo acesso, {user.name} precisará definir uma senha nova.</p>
        {error && <Notice message={error} error />}
        <div className="form-actions">
          <button type="button" className="link-button" onClick={onClose}>Cancelar</button>
          <button type="button" className="secondary" disabled={loading} onClick={() => void reset()}>{loading ? 'Aguarde...' : 'Redefinir senha'}</button>
        </div>
      </> : <>
        <p>Repasse esta senha temporária para <strong>{user.name}</strong>:</p>
        <p className="temporary-password"><code>{result.temporaryPassword}</code></p>
        <p className="muted">Válida até {new Date(result.expiresAt).toLocaleString('pt-BR')}. Esta senha não será exibida novamente.</p>
        {copied && <Notice message="Senha copiada" />}
        {error && <Notice message={error} error />}
        <div className="form-actions">
          <button type="button" className="link-button" onClick={() => void copy()}><Icon name="copy" /> Copiar senha</button>
          <button type="button" className="secondary" onClick={onClose}>Concluir</button>
        </div>
      </>}
    </div>
  </aside>
}
