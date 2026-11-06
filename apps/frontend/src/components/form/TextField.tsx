import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Field, type FieldBaseProps } from './Field'

type InputProps = FieldBaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'required'>
type TextAreaProps = FieldBaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'required'>
type SelectProps = FieldBaseProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'required'>

const fieldProps = ({ label, required, optional, hint, error, aside, className, id }: FieldBaseProps) => ({ label, required, optional, hint, error, aside, className, id })

/** Campo de texto livre. */
export function TextField({ label, required, optional, hint, error, aside, className, id, ...input }: InputProps) {
  return <Field {...fieldProps({ label, required, optional, hint, error, aside, className, id })}>
    {(control) => <input {...input} {...control} className="fm-input" />}
  </Field>
}

export function TextAreaField({ label, required, optional, hint, error, aside, className, id, ...textarea }: TextAreaProps) {
  return <Field {...fieldProps({ label, required, optional, hint, error, aside, className, id })}>
    {(control) => <textarea {...textarea} {...control} className="fm-input fm-textarea" />}
  </Field>
}

export function SelectField({ label, required, optional, hint, error, aside, className, id, children, ...select }: SelectProps) {
  return <Field {...fieldProps({ label, required, optional, hint, error, aside, className, id })}>
    {(control) => <select {...select} {...control} className="fm-input">{children}</select>}
  </Field>
}
