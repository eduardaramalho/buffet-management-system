/** Shared error and loading feedback for report panels. */
export function ReportStatus({ error, loading, onRetry }: Readonly<{ error: string; loading: boolean; onRetry: () => void }>) {
  if (error) return <div className="alert error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>Tentar de novo</button></div>
  return loading ? <output className="report-loading">Carregando relatório...</output> : null
}
