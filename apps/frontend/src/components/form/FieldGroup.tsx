import { useId, type ReactNode } from 'react'
import { FieldError } from './FieldError'

type FieldGroupProps = { label: string; required?: boolean; optional?: boolean; hint?: ReactNode; error?: string; aside?: ReactNode; children: ReactNode }

/** Grupo de opções (cartões, segmentos) com legenda, para que o leitor de tela anuncie a pergunta de cada opção. */
export function FieldGroup({ label, required, optional, hint, error, aside, children }: FieldGroupProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  return <fieldset className="fm-field fm-group" aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}>
    <legend className="fm-label-row">
      <span className="fm-legend">{label}</span>
      {required && <span className="fm-req" aria-hidden="true">*</span>}
      {optional && <span className="fm-opt">(opcional)</span>}
      {aside && <span className="fm-aside">{aside}</span>}
    </legend>
    {children}
    {hint && <small id={hintId} className="fm-hint">{hint}</small>}
    <FieldError id={errorId} message={error} />
  </fieldset>
}
