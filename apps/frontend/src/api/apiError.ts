import axios from 'axios'

export function getApiErrorMessage(cause: unknown, fallback: string): string {
  if (axios.isAxiosError(cause)) return cause.response?.data?.message ?? fallback
  return cause instanceof Error ? cause.message : fallback
}
