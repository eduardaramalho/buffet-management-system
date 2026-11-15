import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { getApiErrorMessage } from '../api/apiError'

export type LoadStatus = 'loading' | 'ready' | 'error'

interface UseInitialLoadOptions<T> {
  /** Applies the fetched data to the screen state. Never called for a response that is no longer current. */
  onData: (data: T) => void
  /** Message shown when the API does not send one. */
  errorMessage: string
  /** Serialized filters: when it changes the data is fetched again without going back to loading. */
  key?: string
  /** While false nothing is requested (for example, a tab that is not open). */
  enabled?: boolean
}

type LoadState = { status: LoadStatus; message: string }

/**
 * KAN-79: tracks the first load of a screen so it never renders placeholder data (zeroed totals, empty
 * lists) before the API answers. Only the first load goes through 'loading'; after that, reloads caused by
 * a new key keep the current data on screen and a failure is reported as refreshError instead of error.
 * Late responses for an old key are discarded.
 */
export function useInitialLoad<T>(fetcher: () => Promise<T>, { onData, errorMessage, key = '', enabled = true }: UseInitialLoadOptions<T>) {
  const [state, setState] = useState<LoadState>({ status: 'loading', message: '' })
  const [attempt, setAttempt] = useState(0)
  const runFetch = useEffectEvent(fetcher)
  const applyData = useEffectEvent(onData)
  const applyError = useEffectEvent((cause: unknown) => {
    const message = getApiErrorMessage(cause, errorMessage)
    setState((current) => ({ status: current.status === 'ready' ? 'ready' : 'error', message }))
  })

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    runFetch()
      .then((data) => {
        if (!active) return
        applyData(data)
        setState({ status: 'ready', message: '' })
      })
      .catch((cause: unknown) => { if (active) applyError(cause) })
    return () => { active = false }
  }, [enabled, key, attempt])

  const retry = useCallback(() => {
    setState((current) => (current.status === 'error' ? { status: 'loading', message: '' } : current))
    setAttempt((count) => count + 1)
  }, [])

  return {
    status: state.status,
    /** Failure of the first load: the screen has no data to show. */
    error: state.status === 'error' ? state.message : '',
    /** Failure of a later reload: the previous data stays on screen. */
    refreshError: state.status === 'ready' ? state.message : '',
    retry,
  }
}
