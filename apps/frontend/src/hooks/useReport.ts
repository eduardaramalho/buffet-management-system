import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { getApiErrorMessage } from '../api/apiError'

type Settled<T> = { requestKey: string; data?: T; error: string }

/**
 * Loads a report whenever its key (serialized filters) changes. Loading is derived from comparing the
 * settled key with the current one, so the effect never sets state synchronously; the previous data stays
 * on screen while the next request runs, and late responses for an old key are discarded.
 * A null key means the filters are invalid and nothing is requested.
 */
export function useReport<T>(load: () => Promise<T>, key: string | null) {
  const [reloadCount, setReloadCount] = useState(0)
  const [settled, setSettled] = useState<Settled<T>>()
  const [lastData, setLastData] = useState<T>()
  const requestKey = key === null ? null : `${key}#${reloadCount}`
  const runLoad = useEffectEvent(load)

  useEffect(() => {
    if (requestKey === null) return
    let active = true
    runLoad()
      .then((data) => { if (active) { setSettled({ requestKey, data, error: '' }); setLastData(data) } })
      .catch((cause: unknown) => { if (active) setSettled({ requestKey, error: getApiErrorMessage(cause, 'Não foi possível carregar o relatório') }) })
    return () => { active = false }
  }, [requestKey])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])
  const loading = requestKey !== null && settled?.requestKey !== requestKey
  const error = !loading && settled?.requestKey === requestKey ? settled.error : ''

  return { data: lastData, loading, error, reload }
}
