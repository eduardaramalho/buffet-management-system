// The buffet operates in a single time zone; exported files must show local dates regardless of the
// server's own time zone (the container runs in UTC). Brazil has no daylight saving time since 2019.
export const REPORT_TIME_ZONE = "America/Sao_Paulo";

const dateTimeParts = new Intl.DateTimeFormat("pt-BR", {
  timeZone: REPORT_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function parts(date: Date) {
  const values = Object.fromEntries(dateTimeParts.formatToParts(date).map((part) => [part.type, part.value]));
  return { day: values.day, month: values.month, year: values.year, hour: values.hour, minute: values.minute };
}

/** dd/MM/yyyy */
export function formatDate(date: Date): string {
  const { day, month, year } = parts(date);
  return `${day}/${month}/${year}`;
}

/** dd/MM/yyyy HH:mm */
export function formatDateTime(date: Date): string {
  const { hour, minute } = parts(date);
  return `${formatDate(date)} ${hour}:${minute}`;
}

/** yyyy-MM-dd, used in file names. */
export function formatIsoDate(date: Date): string {
  const { day, month, year } = parts(date);
  return `${year}-${month}-${day}`;
}

export const formatOptionalDateTime = (date: Date | null) => (date ? formatDateTime(date) : null);
export const formatPercentage = (value: number | null) => (value === null ? "Sem dados" : `${numberFormat.format(value)}%`);
export const formatMinutes = (value: number | null) => (value === null ? "Sem dados" : `${numberFormat.format(value)} min`);
