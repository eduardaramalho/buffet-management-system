export const CLIENT_TYPES = ['PF', 'PJ'] as const
export type ClientType = typeof CLIENT_TYPES[number]
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = { PF: 'Pessoa física', PJ: 'Pessoa jurídica' }

export type Client = {
  id: string
  type: ClientType
  name: string
  // Stored without punctuation by the API (CPF: 11 digits, CNPJ: 14 chars, alphanumeric since 07/2026).
  document: string | null
  email: string | null
  phone: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type ClientInput = Pick<Client, 'type' | 'name' | 'document' | 'email' | 'phone' | 'notes'>
export type ClientFilters = { search?: string }
