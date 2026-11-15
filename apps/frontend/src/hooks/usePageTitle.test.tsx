import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { APP_NAME, formatPageTitle, usePageTitle } from './usePageTitle'

describe('formatPageTitle', () => {
  it('junta o nome da tela com o nome do sistema', () => {
    expect(formatPageTitle('Clientes')).toBe('Clientes · EventosPro')
  })

  it('usa só o nome do sistema quando a tela não tem título', () => {
    expect(formatPageTitle()).toBe(APP_NAME)
    expect(formatPageTitle('   ')).toBe(APP_NAME)
  })

  it('remove espaços extras do título', () => {
    expect(formatPageTitle('  Eventos  ')).toBe('Eventos · EventosPro')
  })
})

describe('usePageTitle', () => {
  afterEach(() => { document.title = '' })

  it('define o título da aba ao montar a tela', () => {
    renderHook(() => usePageTitle('Tarefas'))
    expect(document.title).toBe('Tarefas · EventosPro')
  })

  it('atualiza o título quando o valor muda, como no nome do evento carregado', () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), { initialProps: { title: 'Evento' } })
    expect(document.title).toBe('Evento · EventosPro')
    rerender({ title: 'Casamento Ana e Bruno' })
    expect(document.title).toBe('Casamento Ana e Bruno · EventosPro')
  })
})
