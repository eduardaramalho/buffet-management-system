import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const visibleFocusable = (root: HTMLElement | null) =>
  Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter((element) => !element.closest('[hidden]'))

type Options = Readonly<{
  onClose: () => void
  /** While true (e.g. saving), Escape does not close the dialog. */
  locked?: boolean
}>

/**
 * Comportamento comum dos diálogos modais (ADR 0016): trava a rolagem da página, devolve o foco
 * para quem abriu, fecha com Esc e mantém o Tab circulando dentro do diálogo.
 * O teclado é tratado por um listener nativo no próprio elemento do diálogo (<dialog open>), e não por
 * onKeyDown no JSX, para não pendurar eventos de teclado em elemento não interativo (KAN-88).
 */
export function useModalDialog(dialogRef: RefObject<HTMLElement | null>, { onClose, locked = false }: Options) {
  // Guarda a versão mais recente das opções: o listener é registrado uma vez só, na montagem.
  const optionsRef = useRef({ onClose, locked })
  useEffect(() => { optionsRef.current = { onClose, locked } })

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        if (!optionsRef.current.locked) optionsRef.current.onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = visibleFocusable(dialog)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    dialog.addEventListener('keydown', handleKeyDown)
    return () => dialog.removeEventListener('keydown', handleKeyDown)
  }, [dialogRef])
}
