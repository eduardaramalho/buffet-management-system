import type { ButtonHTMLAttributes } from 'react'

export function Button(props: Readonly<ButtonHTMLAttributes<HTMLButtonElement>>) { return <button {...props} /> }