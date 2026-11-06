import { describe, expect, it } from 'vitest'
import { maskCnpj, maskCpf, maskInteger, maskPhone, onlyDigits, unmaskDocument } from './masks'

describe('masks', () => {
  it('keeps only digits', () => {
    expect(onlyDigits('(47) 9a9')).toBe('4799')
  })

  it.each([
    ['', ''],
    ['4', '(4'],
    ['47', '(47'],
    ['473', '(47) 3'],
    ['4733334444', '(47) 3333-4444'],
    ['47999990000', '(47) 99999-0000'],
    ['(47) 99999-00001234', '(47) 99999-0000'],
  ])('masks phone %s as %s', (input, expected) => {
    expect(maskPhone(input)).toBe(expected)
  })

  it.each([
    ['123', '123'],
    ['1234', '123.4'],
    ['1234567', '123.456.7'],
    ['12345678901', '123.456.789-01'],
    ['123.456.789-0199', '123.456.789-01'],
  ])('masks CPF %s as %s', (input, expected) => {
    expect(maskCpf(input)).toBe(expected)
  })

  it.each([
    ['12', '12'],
    ['123', '12.3'],
    ['12345678', '12.345.678'],
    ['123456780001', '12.345.678/0001'],
    ['12345678000195', '12.345.678/0001-95'],
    ['12abc34500d1', '12.ABC.345/00D1'],
    ['12ABC34500D1X9', '12.ABC.345/00D1-9'],
  ])('masks CNPJ %s as %s', (input, expected) => {
    expect(maskCnpj(input)).toBe(expected)
  })

  it('masks integers with a maximum length', () => {
    expect(maskInteger(4)('1e2-3.45')).toBe('1234')
  })

  it('removes the document punctuation like the API does', () => {
    expect(unmaskDocument('12.abc.345/00d1-95')).toBe('12ABC34500D195')
  })
})
