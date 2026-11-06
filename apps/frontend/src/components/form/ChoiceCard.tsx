import type { InputHTMLAttributes, ReactNode } from 'react'

type ChoiceCardProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  type: 'checkbox' | 'radio'
  title: string
  description?: ReactNode
}

/** Opção em cartão (caixa de seleção ou rádio). O cartão inteiro é clicável porque envolve o input. */
export function ChoiceCard({ type, title, description, checked, className, ...input }: ChoiceCardProps) {
  return <label className={`fm-choice${checked ? ' on' : ''}${className ? ` ${className}` : ''}`}>
    <input {...input} type={type} checked={checked} aria-label={title} />
    <span><strong>{title}</strong>{description && <small>{description}</small>}</span>
  </label>
}
