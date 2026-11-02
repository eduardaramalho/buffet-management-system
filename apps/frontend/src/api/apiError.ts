import axios from 'axios'

export function getApiErrorMessage(cause: unknown, fallback: string): string {
  if (axios.isAxiosError(cause)) return cause.response?.data?.message ?? fallback
  return cause instanceof Error ? cause.message : fallback
}

/** Código de erro de negócio enviado pelo backend (por exemplo, TEMP_PASSWORD_EXPIRED), quando houver. */
export function getApiErrorCode(cause: unknown): string | undefined {
  if (!axios.isAxiosError(cause)) return undefined
  const code: unknown = cause.response?.data?.code
  return typeof code === 'string' ? code : undefined
}
