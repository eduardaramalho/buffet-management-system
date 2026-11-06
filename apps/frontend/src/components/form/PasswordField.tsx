import { useState, type InputHTMLAttributes } from 'react'
import { Icon } from '../Icon'
import { Field, type FieldBaseProps } from './Field'

type PasswordFieldProps = FieldBaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'required' | 'type'>

/** Senha com botão para mostrar ou ocultar (estado informado por aria-pressed). */
export function PasswordField({ label, required, optional, hint, error, aside, className, id, ...input }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return <Field label={label} required={required} optional={optional} hint={hint} error={error} aside={aside} className={className} id={id}>
    {(control) => <span className="fm-input-wrap">
      <input {...input} {...control} type={visible ? 'text' : 'password'} className="fm-input" />
      <button type="button" className="fm-input-action" aria-label="Mostrar senha" aria-pressed={visible} aria-controls={control.id} onClick={() => setVisible((current) => !current)}>
        <Icon name={visible ? 'eye-off' : 'eye'} />
      </button>
    </span>}
  </Field>
}
