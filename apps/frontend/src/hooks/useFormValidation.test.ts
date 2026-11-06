import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { useFormValidation } from './useFormValidation'

const schema = z.object({ name: z.string().min(1, 'Informe o nome.') })

const setup = () => {
  document.body.innerHTML = '<div role="dialog"><input id="inside" /><section hidden><input id="hidden" /></section><button id="save"></button></div><button id="opener"></button>'
  const byId = (id: string) => document.getElementById(id) as HTMLElement
  const { result } = renderHook(() => useFormValidation(schema, { name: '' }))
  return { result, byId }
}

describe('useFormValidation', () => {
  it('shows the error after the person leaves the field inside the dialog', () => {
    const { result, byId } = setup()
    expect(result.current.errorFor('name')).toBeUndefined()

    act(() => result.current.touch('name', { target: byId('inside'), relatedTarget: byId('save') }))

    expect(result.current.errorFor('name')).toBe('Informe o nome.')
  })

  it('ignores the blur caused by hiding a section or by focus leaving the dialog', () => {
    const { result, byId } = setup()

    act(() => result.current.touch('name', { target: byId('hidden'), relatedTarget: null }))
    act(() => result.current.touch('name', { target: byId('inside'), relatedTarget: byId('opener') }))

    expect(result.current.errorFor('name')).toBeUndefined()
    expect(result.current.errors).toEqual({ name: 'Informe o nome.' })
  })

  it('shows every error and counts the attempt when submitting invalid data', () => {
    const { result } = setup()
    let data: unknown
    act(() => { data = result.current.submit() })

    expect(data).toBeNull()
    expect(result.current.invalidAttempt).toBe(1)
    expect(result.current.errorFor('name')).toBe('Informe o nome.')
  })
})
