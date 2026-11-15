import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useInitialLoad } from './useInitialLoad'

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('useInitialLoad', () => {
  it('starts loading and becomes ready only after applying the data', async () => {
    const request = deferred<string[]>()
    const onData = vi.fn()
    const { result } = renderHook(() => useInitialLoad(() => request.promise, { onData, errorMessage: 'Falhou' }))

    expect(result.current.status).toBe('loading')
    expect(onData).not.toHaveBeenCalled()

    await act(async () => { request.resolve(['a']) })

    expect(result.current.status).toBe('ready')
    expect(onData).toHaveBeenCalledWith(['a'])
    expect(result.current.error).toBe('')
  })

  it('reports the first failure as an error, with the fallback message, and retries back to loading', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce('x').mockResolvedValue(['b'])
    const onData = vi.fn()
    const { result } = renderHook(() => useInitialLoad(fetcher, { onData, errorMessage: 'Erro ao carregar' }))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('Erro ao carregar')
    expect(onData).not.toHaveBeenCalled()

    act(() => result.current.retry())
    expect(result.current.status).toBe('loading')
    expect(result.current.error).toBe('')

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(onData).toHaveBeenCalledWith(['b'])
  })

  it('uses the API message when the error carries one', async () => {
    const { result } = renderHook(() => useInitialLoad(() => Promise.reject(new Error('Sem permissão')), { onData: vi.fn(), errorMessage: 'Falhou' }))
    await waitFor(() => expect(result.current.error).toBe('Sem permissão'))
  })

  it('reloads silently when the key changes and keeps the screen ready on a later failure', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(['inicial']).mockRejectedValueOnce(new Error('Falha no filtro')).mockResolvedValue(['filtrado'])
    const onData = vi.fn()
    const { result, rerender } = renderHook(({ key }) => useInitialLoad(fetcher, { onData, errorMessage: 'Falhou', key }), { initialProps: { key: '' } })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ key: 'busca' })
    expect(result.current.status).toBe('ready')
    await waitFor(() => expect(result.current.refreshError).toBe('Falha no filtro'))
    expect(result.current.status).toBe('ready')
    expect(result.current.error).toBe('')

    rerender({ key: 'outra' })
    await waitFor(() => expect(onData).toHaveBeenLastCalledWith(['filtrado']))
    expect(result.current.refreshError).toBe('')
  })

  it('discards the response of a key that is no longer current', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const onData = vi.fn()
    const { rerender } = renderHook(({ key }) => useInitialLoad(fetcher, { onData, errorMessage: 'Falhou', key }), { initialProps: { key: 'a' } })

    rerender({ key: 'b' })
    await act(async () => { second.resolve('b') })
    await act(async () => { first.resolve('a') })

    expect(onData).toHaveBeenCalledTimes(1)
    expect(onData).toHaveBeenCalledWith('b')
  })

  it('does not request while disabled and loads as soon as it is enabled', async () => {
    const fetcher = vi.fn().mockResolvedValue(['x'])
    const { result, rerender } = renderHook(({ enabled }) => useInitialLoad(fetcher, { onData: vi.fn(), errorMessage: 'Falhou', enabled }), { initialProps: { enabled: false } })

    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.status).toBe('loading')

    rerender({ enabled: true })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
