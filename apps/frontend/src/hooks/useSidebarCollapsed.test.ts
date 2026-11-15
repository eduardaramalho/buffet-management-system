import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_COLLAPSED_STORAGE_KEY, useSidebarCollapsed } from './useSidebarCollapsed'

describe('useSidebarCollapsed', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { vi.restoreAllMocks() })

  it('começa expandida quando não há preferência salva', () => {
    const { result } = renderHook(() => useSidebarCollapsed())
    expect(result.current.collapsed).toBe(false)
  })

  it('restaura a preferência salva', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true')
    const { result } = renderHook(() => useSidebarCollapsed())
    expect(result.current.collapsed).toBe(true)
  })

  it('alterna o estado e salva a preferência', () => {
    const { result } = renderHook(() => useSidebarCollapsed())
    act(() => { result.current.toggle() })
    expect(result.current.collapsed).toBe(true)
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true')
    act(() => { result.current.toggle() })
    expect(result.current.collapsed).toBe(false)
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('false')
  })

  it('continua funcionando quando o armazenamento do navegador está indisponível', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useSidebarCollapsed())
    expect(result.current.collapsed).toBe(false)
    act(() => { result.current.toggle() })
    expect(result.current.collapsed).toBe(true)
  })
})
