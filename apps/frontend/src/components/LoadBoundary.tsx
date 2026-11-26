import { useEffect, useState, type ReactNode } from 'react'
import type { LoadStatus } from '../hooks/useInitialLoad'

/**
 * Below this time the indicator is not shown: a fast response goes straight from the blank area to the
 * data, without a spinner blinking on screen (KAN-79).
 */
export const LOADING_INDICATOR_DELAY_MS = 300

export function LoadingIndicator({ label = 'Carregando...' }: Readonly<{ label?: string }>) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), LOADING_INDICATOR_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])
  return <div className="page-loading" aria-busy="true">
    {visible && <output><span className="spinner" aria-hidden="true" />{label}</output>}
  </div>
}

interface LoadBoundaryProps {
  status: LoadStatus
  error: string
  onRetry?: () => void
  label?: string
  children: ReactNode
}

/** Renders the content only after the first load succeeds; before that, the loading indicator or the error. */
export function LoadBoundary({ status, error, onRetry, label, children }: Readonly<LoadBoundaryProps>) {
  if (status === 'loading') return <LoadingIndicator label={label} />
  if (status === 'error') return <div className="alert error" role="alert">
    <span>{error}</span>
    {onRetry && <button type="button" onClick={onRetry}>Tentar de novo</button>}
  </div>
  return <>{children}</>
}
