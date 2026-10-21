import { describe, expect, it } from 'vitest'
import { formatDocument } from './document'

describe('formatDocument', () => {
  it('formats CPF and numeric or alphanumeric CNPJ stored without punctuation', () => {
    expect(formatDocument('52998224725')).toBe('529.982.247-25')
    expect(formatDocument('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatDocument('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
  })

  it('returns a dash for an empty document and the raw value for unknown lengths', () => {
    expect(formatDocument(null)).toBe('-')
    expect(formatDocument('123')).toBe('123')
  })
})
