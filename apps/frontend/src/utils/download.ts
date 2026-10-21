export function filenameFromDisposition(header: string | undefined, fallback: string): string {
  const match = header?.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? fallback
}

/** Triggers a browser download for an in-memory file without leaving elements or object URLs behind. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
