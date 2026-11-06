import type { InputHTMLAttributes } from 'react'
import type { Mask } from '../../utils/masks'

type MaskedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  mask: Mask
  onValueChange: (value: string) => void
}

/** Entrada com máscara sem rótulo próprio, para linhas de tabela e faixas (o nome vem por aria-label). */
export function MaskedInput({ value, mask, onValueChange, className, ...input }: MaskedInputProps) {
  return <input {...input} className={`fm-input${className ? ` ${className}` : ''}`} value={value} onChange={(event) => onValueChange(mask(event.target.value))} />
}
