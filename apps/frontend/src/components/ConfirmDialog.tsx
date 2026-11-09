import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalDialog } from '../hooks/useModalDialog'

type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmação de ação irreversível (cancelar ou excluir tarefa). Substitui o window.confirm do navegador:
 * segue o visual do sistema e começa focado em "Voltar", a opção segura.
 */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const handleKeyDown = useModalDialog(dialogRef, { onClose: onCancel })

  useEffect(() => { cancelRef.current?.focus() }, [])

  return createPortal(<div className="fm-backdrop confirm-backdrop">
    <div ref={dialogRef} className="fm-dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} onKeyDown={handleKeyDown}>
      <h2 id={titleId}>{title}</h2>
      <p id={messageId}>{message}</p>
      <div className="confirm-actions">
        <button ref={cancelRef} type="button" className="fm-btn fm-btn-secondary" onClick={onCancel}>Voltar</button>
        <button type="button" className="fm-btn confirm-danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>, document.body)
}
