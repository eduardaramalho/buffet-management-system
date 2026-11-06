const CPF_LENGTH = 11
const CNPJ_LENGTH = 14

// Display only: the API stores and validates the document (check digits included).
export function formatDocument(value: string | null): string {
  if (!value) return '-'
  if (value.length === CPF_LENGTH) return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (value.length === CNPJ_LENGTH) return value.replace(/^(\w{2})(\w{3})(\w{3})(\w{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return value
}

// Mesmo algoritmo do backend (apps/backend/src/modules/clients/domain/document.ts): a tela recusa o documento
// inválido antes do envio e a API continua validando.
const CPF_PATTERN = /^\d{11}$/
const CNPJ_PATTERN = /^[0-9A-Z]{12}\d{2}$/
const REPEATED_CHAR_PATTERN = /^(.)\1+$/
const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const CNPJ_SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const ASCII_ZERO = 48

const mod11Digit = (sum: number) => {
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

const cpfDigit = (digits: string, firstWeight: number) =>
  mod11Digit([...digits].reduce((sum, digit, index) => sum + Number(digit) * (firstWeight - index), 0))

export function isValidCpf(value: string): boolean {
  if (!CPF_PATTERN.test(value) || REPEATED_CHAR_PATTERN.test(value)) return false
  const first = cpfDigit(value.slice(0, 9), 10)
  const second = cpfDigit(value.slice(0, 9) + first, 11)
  return value.endsWith(`${first}${second}`)
}

// Cada caractere vale o código ASCII menos 48 (dígitos mantêm o valor, A = 17 ... Z = 42).
const cnpjDigit = (chars: string, weights: number[]) =>
  mod11Digit([...chars].reduce((sum, char, index) => sum + (char.charCodeAt(0) - ASCII_ZERO) * weights[index], 0))

export function isValidCnpj(value: string): boolean {
  if (!CNPJ_PATTERN.test(value) || REPEATED_CHAR_PATTERN.test(value)) return false
  const first = cnpjDigit(value.slice(0, 12), CNPJ_FIRST_WEIGHTS)
  const second = cnpjDigit(value.slice(0, 12) + first, CNPJ_SECOND_WEIGHTS)
  return value.endsWith(`${first}${second}`)
}
