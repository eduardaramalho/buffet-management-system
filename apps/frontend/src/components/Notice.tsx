type NoticeProps = { message: string; error?: boolean; warning?: boolean }

/** Mensagem de retorno. Erro e aviso usam role="alert" para serem anunciados assim que aparecem. */
export function Notice({ message, error = false, warning = false }: NoticeProps) {
  const tone = error ? ' error' : warning ? ' warning' : ''
  return <div role={error || warning ? 'alert' : 'status'} className={`alert${tone}`}>{message}</div>
}
