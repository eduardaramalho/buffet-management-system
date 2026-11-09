import { useEffect, type KeyboardEvent, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const visibleFocusable = (root: HTMLElement | null) =>
  Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter((element) => !element.closest('[hidden]'))

type Options = {
  onClose: () => void
  /** While true (e.g. saving), Escape does not close the dialog. */
  locked?: boolean
}

/**
 * Comportamento comum dos diálogos modais (ADR 0016): trava a rolagem da página, devolve o foco
 * para quem abriu, fecha com Esc e mantém o Tab circulando dentro do diálogo.
 * Retorna o handler de teclado para o elemento com role="dialog".
 */
export function useModalDialog(dialogRef: RefObject<HTMLElement | null>, { onClose, locked = false }: Options) {
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      if (!locked) onClose()
      return
    }
    if (event.key !== 'Tab') return
    event.stopPropagation()
    const focusable = visibleFocusable(dialogRef.current)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
}
