import type { InputHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: IconName }

/** Campo com rótulo. O ícone é decorativo e fica dentro do campo, à esquerda. */
export function FormField({ label, icon, ...props }: FormFieldProps) {
  if (!icon) return <label>{label}<input {...props} /></label>
  return <label>{label}<span className="input-wrap has-icon"><Icon name={icon} className="input-icon" /><input {...props} /></span></label>
}
