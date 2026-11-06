import type { InputHTMLAttributes } from 'react'
import type { Mask } from '../../utils/masks'
import { Field, type FieldBaseProps } from './Field'

type MaskedFieldProps = FieldBaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'required' | 'value' | 'onChange'> & {
  value: string
  mask: Mask
  /** Recebe o valor já formatado pela máscara. */
  onValueChange: (value: string) => void
}

/** Campo com formato definido (telefone, CPF/CNPJ, números): a máscara é aplicada a cada digitação ou colagem. */
export function MaskedField({ label, required, optional, hint, error, aside, className, id, value, mask, onValueChange, ...input }: MaskedFieldProps) {
  return <Field label={label} required={required} optional={optional} hint={hint} error={error} aside={aside} className={className} id={id}>
    {(control) => <input {...input} {...control} className="fm-input" value={value} onChange={(event) => onValueChange(mask(event.target.value))} />}
  </Field>
}
