import { useState } from 'react'
import { getApiErrorMessage } from '../../api/apiError'
import type { ExportFormat } from '../../types/report'
import { Icon } from '../Icon'
import { Notice } from '../Notice'

const FORMATS: Array<{ format: ExportFormat; label: string }> = [{ format: 'csv', label: 'Exportar CSV' }, { format: 'pdf', label: 'Exportar PDF' }]

export function ExportButtons({ onExport, disabled }: { onExport: (format: ExportFormat) => Promise<void>; disabled: boolean }) {
  const [busy, setBusy] = useState<ExportFormat>()
  const [error, setError] = useState('')

  const run = async (format: ExportFormat) => {
    setBusy(format)
    setError('')
    try { await onExport(format) }
    catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível exportar o relatório')) }
    finally { setBusy(undefined) }
  }

  return <div className="report-export">
    {FORMATS.map(({ format, label }) => <button key={format} type="button" className="ghost-button" aria-label={label} disabled={disabled || busy !== undefined} onClick={() => void run(format)}>
      <Icon name="download" />{busy === format ? 'Gerando...' : label}
    </button>)}
    {error && <Notice message={error} error />}
  </div>
}
