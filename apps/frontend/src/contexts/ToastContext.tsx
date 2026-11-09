import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { ToastContext, type ToastApi } from './toast'

type ToastTone = 'success' | 'error'
type Toast = { id: number; message: string; tone: ToastTone }
export const TOAST_DURATION_MS = 4000

/** Avisos curtos (sucesso ou erro). Ficam numa região aria-live para serem lidos por leitores de tela. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const show = useCallback((message: string, tone: ToastTone) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message, tone }])
    timers.current.set(id, setTimeout(() => dismiss(id), TOAST_DURATION_MS))
  }, [dismiss])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  const api = useMemo<ToastApi>(() => ({ success: (message) => show(message, 'success'), error: (message) => show(message, 'error') }), [show])

  return <ToastContext.Provider value={api}>
    {children}
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((toast) => <div key={toast.id} className={`toast${toast.tone === 'error' ? ' toast-error' : ''}`}>
        <Icon name={toast.tone === 'error' ? 'alert' : 'check'} />
        <span>{toast.message}</span>
        <button type="button" className="toast-close" aria-label="Fechar aviso" onClick={() => dismiss(toast.id)}><Icon name="x" /></button>
      </div>)}
    </div>
  </ToastContext.Provider>
}
