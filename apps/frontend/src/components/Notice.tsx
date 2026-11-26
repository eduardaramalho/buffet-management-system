type NoticeProps = { message: string; error?: boolean; warning?: boolean }

/** Mensagem de retorno. Erro e aviso usam role="alert" para serem anunciados assim que aparecem. */
export function Notice({ message, error = false, warning = false }: Readonly<NoticeProps>) {
  let tone = ''
  if (error) tone = ' error'
  else if (warning) tone = ' warning'
  return <div role={error || warning ? 'alert' : 'status'} className={`alert${tone}`}>{message}</div>
}
