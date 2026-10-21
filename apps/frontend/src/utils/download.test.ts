import { afterEach, describe, expect, it, vi } from 'vitest'
import { filenameFromDisposition, saveBlob } from './download'

describe('download', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('reads the file name from a Content-Disposition header', () => {
    expect(filenameFromDisposition('attachment; filename="relatorio-eventos_2026-10-01_2026-10-31.csv"', 'x.csv')).toBe('relatorio-eventos_2026-10-01_2026-10-31.csv')
    expect(filenameFromDisposition('attachment; filename=relatorio.pdf', 'x.pdf')).toBe('relatorio.pdf')
    expect(filenameFromDisposition(undefined, 'fallback.csv')).toBe('fallback.csv')
  })

  it('saves a blob through a temporary link and releases the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:report')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const blob = new Blob(['a;b'])

    saveBlob(blob, 'relatorio.csv')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalledTimes(1)
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.download).toBe('relatorio.csv')
    expect(anchor.href).toBe('blob:report')
    expect(anchor.isConnected).toBe(false)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report')
  })
})
