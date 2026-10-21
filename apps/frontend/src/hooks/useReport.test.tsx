import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useReport } from './useReport'

describe('useReport', () => {
  it('loads data for the current key and exposes the loading state', async () => {
    const load = vi.fn().mockResolvedValue({ total: 3 })

    const { result } = renderHook(() => useReport(load, 'a'))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ total: 3 })
    expect(result.current.error).toBe('')
  })

  it('reloads when the key changes, keeping the previous data visible while loading', async () => {
    let resolveSecond: (value: string) => void = () => undefined
    const load = vi.fn().mockResolvedValueOnce('first').mockImplementationOnce(() => new Promise<string>((resolve) => { resolveSecond = resolve }))

    const { result, rerender } = renderHook(({ key }) => useReport(load, key), { initialProps: { key: 'a' } })
    await waitFor(() => expect(result.current.data).toBe('first'))
    rerender({ key: 'b' })

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBe('first')
    await act(async () => { resolveSecond('second') })
    expect(result.current.data).toBe('second')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale response that arrives after the key changed', async () => {
    let resolveFirst: (value: string) => void = () => undefined
    const load = vi.fn().mockImplementationOnce(() => new Promise<string>((resolve) => { resolveFirst = resolve })).mockResolvedValueOnce('fresh')

    const { result, rerender } = renderHook(({ key }) => useReport(load, key), { initialProps: { key: 'a' } })
    rerender({ key: 'b' })
    await waitFor(() => expect(result.current.data).toBe('fresh'))
    await act(async () => { resolveFirst('stale') })

    expect(result.current.data).toBe('fresh')
  })

  it('reports the API error message and recovers on reload', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('Falhou')).mockResolvedValueOnce('ok')

    const { result } = renderHook(() => useReport(load, 'a'))
    await waitFor(() => expect(result.current.error).toBe('Falhou'))
    act(() => { result.current.reload() })

    await waitFor(() => expect(result.current.data).toBe('ok'))
    expect(result.current.error).toBe('')
  })

  it('does not load while the key is null (invalid filters)', () => {
    const load = vi.fn()

    const { result } = renderHook(() => useReport(load, null))

    expect(load).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })
})
