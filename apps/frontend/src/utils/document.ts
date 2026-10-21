const CPF_LENGTH = 11
const CNPJ_LENGTH = 14

// Display only: the API stores and validates the document (check digits included).
export function formatDocument(value: string | null): string {
  if (!value) return '-'
  if (value.length === CPF_LENGTH) return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (value.length === CNPJ_LENGTH) return value.replace(/^(\w{2})(\w{3})(\w{3})(\w{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return value
}
