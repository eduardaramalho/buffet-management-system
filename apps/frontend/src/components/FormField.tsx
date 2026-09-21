import type { InputHTMLAttributes } from 'react'

export function FormField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label>{label}<input {...props} /></label>
}