import { Icon } from '../Icon'

type FieldErrorProps = { id?: string; message?: string }

/** Mensagem de erro exibida logo abaixo do campo e ligada a ele por aria-describedby. */
export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null
  return <span id={id} className="fm-error"><Icon name="alert" />{message}</span>
}
