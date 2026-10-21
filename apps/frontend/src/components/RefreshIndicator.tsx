import { useEffect, useState } from 'react'

const TICK_MS = 1000

interface RefreshIndicatorProps {
  lastUpdatedAt: number
  refreshing: boolean
  onRefresh: () => void
}

export function RefreshIndicator({ lastUpdatedAt, refreshing, onRefresh }: RefreshIndicatorProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.floor((now - lastUpdatedAt) / TICK_MS))
  return <div className="refresh-indicator">
    <small role="status">Atualizado há {seconds} s</small>
    <button type="button" className="link-button" disabled={refreshing} onClick={onRefresh}>Atualizar agora</button>
  </div>
}
