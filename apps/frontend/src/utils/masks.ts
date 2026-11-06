/**
 * Máscaras de entrada. Cada função recebe o texto digitado (ou colado) e devolve o valor já formatado,
 * aceitando entrada parcial: a máscara acompanha a digitação em vez de esperar o campo completo.
 * O valor enviado à API sai das funções unmask* (sem pontuação), salvo quando a API aceita o formato.
 */
export type Mask = (value: string) => string

export const onlyDigits = (value: string) => value.replace(/\D/g, '')

const PHONE_MAX_DIGITS = 11
const CPF_DIGITS = 11
// Desde 07/2026 o CNPJ pode ter letras nas 12 primeiras posições; os 2 dígitos verificadores seguem numéricos.
const CNPJ_CHARS = 14
const CNPJ_BODY = 12

/** (47) 3333-4444 para fixo e (47) 99999-0000 para celular. */
export const maskPhone: Mask = (value) => {
  const digits = onlyDigits(value).slice(0, PHONE_MAX_DIGITS)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  const area = digits.slice(0, 2)
  const rest = digits.slice(2)
  // Com 11 dígitos o número tem 5 antes do hífen (celular); até 10, tem 4 (fixo).
  const split = digits.length === PHONE_MAX_DIGITS ? 5 : 4
  if (rest.length <= split) return `(${area}) ${rest}`
  return `(${area}) ${rest.slice(0, split)}-${rest.slice(split)}`
}

/** 000.000.000-00 */
export const maskCpf: Mask = (value) => {
  const digits = onlyDigits(value).slice(0, CPF_DIGITS)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

/** 00.000.000/0000-00, com letras maiúsculas aceitas nas 12 primeiras posições (CNPJ alfanumérico). */
export const maskCnpj: Mask = (value) => {
  const raw = value.toUpperCase().replace(/[^0-9A-Z]/g, '')
  // Os dois últimos caracteres são dígitos verificadores: letras depois da 12ª posição são descartadas.
  const chars = (raw.slice(0, CNPJ_BODY) + onlyDigits(raw.slice(CNPJ_BODY))).slice(0, CNPJ_CHARS)
  const parts = [chars.slice(0, 2), chars.slice(2, 5), chars.slice(5, 8), chars.slice(8, 12), chars.slice(12, 14)]
  let masked = parts[0]
  if (parts[1]) masked += `.${parts[1]}`
  if (parts[2]) masked += `.${parts[2]}`
  if (parts[3]) masked += `/${parts[3]}`
  if (parts[4]) masked += `-${parts[4]}`
  return masked
}

/** Número inteiro positivo, sem sinal, ponto ou expoente; maxDigits evita valores fora do que a API aceita. */
export const maskInteger = (maxDigits: number): Mask => (value) => onlyDigits(value).slice(0, maxDigits)

/** Remove a pontuação do documento, como faz a API (normalizeDocument). */
export const unmaskDocument = (value: string) => value.replace(/[.\-/\s]/g, '').toUpperCase()
