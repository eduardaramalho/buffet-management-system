import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePolling } from './usePolling'

const INTERVAL = 1000

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('usePolling', () => {
  beforeEach(() => { vi.useFakeTimers(); setVisibility('visible') })
  afterEach(() => { vi.useRealTimers() })

  it('dispara a função a cada intervalo', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: INTERVAL }))
    expect(fn).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL) })
    expect(fn).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL * 2) })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('pausa com a aba oculta e retoma atualizando ao voltar', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: INTERVAL }))
    act(() => setVisibility('hidden'))
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL * 5) })
    expect(fn).not.toHaveBeenCalled()
    await act(async () => { setVisibility('visible') })
    expect(fn).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL) })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('não sobrepõe chamadas em andamento', async () => {
    let release: () => void = () => undefined
    const fn = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { release = resolve }))
    renderHook(() => usePolling(fn, { intervalMs: INTERVAL }))
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL * 3) })
    expect(fn).toHaveBeenCalledTimes(1)
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(INTERVAL) })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('limpa o timer ao desmontar', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const { unmount } = renderHook(() => usePolling(fn, { intervalMs: INTERVAL }))
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL * 3) })
    expect(fn).not.toHaveBeenCalled()
  })

  it('ignora erro da rodada, mantém o polling e não atualiza o timestamp', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('falha')).mockResolvedValue(undefined)
    const { result } = renderHook(() => usePolling(fn, { intervalMs: INTERVAL }))
    const initial = result.current.lastUpdatedAt
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL) })
    expect(result.current.lastUpdatedAt).toBe(initial)
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL) })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(result.current.lastUpdatedAt).toBeGreaterThan(initial)
  })

  it('refresh força uma atualização imediata', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => usePolling(fn, { intervalMs: INTERVAL }))
    await act(async () => { await result.current.refresh() })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('não executa quando desabilitado', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: INTERVAL, enabled: false }))
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL * 3) })
    expect(fn).not.toHaveBeenCalled()
  })
})
