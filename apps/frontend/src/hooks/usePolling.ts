import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_POLLING_INTERVAL_MS = 30_000
const configuredInterval = Number(import.meta.env.VITE_POLLING_INTERVAL_MS)
export const POLLING_INTERVAL_MS = Number.isFinite(configuredInterval) && configuredInterval > 0 ? configuredInterval : DEFAULT_POLLING_INTERVAL_MS

interface UsePollingOptions {
  intervalMs?: number
  enabled?: boolean
}

export function usePolling(fn: () => Promise<unknown>, { intervalMs = POLLING_INTERVAL_MS, enabled = true }: UsePollingOptions = {}) {
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now())
  const [refreshing, setRefreshing] = useState(false)
  // Refs evitam recriar o timer a cada render e permitem checar sobreposição sem re-render.
  const fnRef = useRef(fn)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  fnRef.current = fn

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setRefreshing(true)
    try {
      await fnRef.current()
      if (mounted.current) setLastUpdatedAt(Date.now())
    } catch {
      // Falha de uma rodada é intencionalmente ignorada: a tela mantém os dados anteriores.
    } finally {
      inFlight.current = false
      if (mounted.current) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    let timer: ReturnType<typeof setInterval> | undefined
    const start = () => { if (timer === undefined) timer = setInterval(() => { void refresh() }, intervalMs) }
    const stop = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined } }
    const onVisibility = () => {
      stop()
      if (document.visibilityState === 'hidden') return
      void refresh()
      start()
    }
    if (document.visibilityState !== 'hidden') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [enabled, intervalMs, refresh])

  return { lastUpdatedAt, refreshing, refresh }
}
