import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { ToastContext, type ToastApi } from './toast'

type Toast = { id: number; message: string }
export const TOAST_DURATION_MS = 4000

/** Avisos curtos após salvar. Ficam numa região aria-live para serem lidos por leitores de tela. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const success = useCallback((message: string) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message }])
    timers.current.set(id, setTimeout(() => dismiss(id), TOAST_DURATION_MS))
  }, [dismiss])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  const api = useMemo<ToastApi>(() => ({ success }), [success])

  return <ToastContext.Provider value={api}>
    {children}
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((toast) => <div key={toast.id} className="toast">
        <Icon name="check" />
        <span>{toast.message}</span>
        <button type="button" className="toast-close" aria-label="Fechar aviso" onClick={() => dismiss(toast.id)}><Icon name="x" /></button>
      </div>)}
    </div>
  </ToastContext.Provider>
}
