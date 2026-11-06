import { useId, type ReactNode } from 'react'
import { FieldError } from './FieldError'

/** Atributos que o Field repassa ao controle (input, select, textarea) para ligar rótulo, ajuda e erro. */
export type ControlProps = {
  id: string
  'aria-invalid'?: true
  'aria-required'?: true
  'aria-describedby'?: string
}

export type FieldBaseProps = {
  label: string
  /** Mostra o asterisco e marca o controle com aria-required. */
  required?: boolean
  /** Mostra "(opcional)" ao lado do rótulo. */
  optional?: boolean
  hint?: ReactNode
  error?: string
  /** Conteúdo à direita do rótulo, como um contador de caracteres. */
  aside?: ReactNode
  className?: string
  id?: string
}

type FieldProps = FieldBaseProps & { children: (control: ControlProps) => ReactNode }

/**
 * Estrutura comum de todo campo: rótulo, marcação de obrigatório/opcional, controle, ajuda e erro.
 * O asterisco fica fora do <label> para não entrar no nome acessível; o aria-required informa o leitor de tela.
 */
export function Field({ label, required, optional, hint, error, aside, className, id, children }: FieldProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return <div className={`fm-field${className ? ` ${className}` : ''}`}>
    <div className="fm-label-row">
      <label htmlFor={controlId}>{label}</label>
      {required && <span className="fm-req" aria-hidden="true">*</span>}
      {optional && <span className="fm-opt">(opcional)</span>}
      {aside && <span className="fm-aside">{aside}</span>}
    </div>
    {children({ id: controlId, 'aria-invalid': error ? true : undefined, 'aria-required': required ? true : undefined, 'aria-describedby': describedBy })}
    {hint && <small id={hintId} className="fm-hint">{hint}</small>}
    <FieldError id={errorId} message={error} />
  </div>
}
