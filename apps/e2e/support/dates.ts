const pad = (value: number) => String(value).padStart(2, '0')

export const daysFromNow = (days: number, hour = 18) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, 0, 0, 0)
  return date
}

/** Valor aceito por <input type="datetime-local"> (horário local). */
export const toDateTimeLocal = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`

/** Valor aceito por <input type="date">. */
export const toDateInput = (date: Date) => toDateTimeLocal(date).slice(0, 10)
