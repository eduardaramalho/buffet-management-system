const pad = (value: number) => String(value).padStart(2, '0')

// <input type="datetime-local"> works in local time; toISOString() alone would shift the value to UTC.
export function toDateInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDateInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}
