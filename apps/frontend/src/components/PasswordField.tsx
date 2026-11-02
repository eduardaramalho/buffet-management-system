import { useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & {
  id: string
  label: string
  icon?: IconName
  hint?: string
  /** Ação ao lado do rótulo, como o botão "Esqueceu a senha?" do login. */
  action?: ReactNode
}

/**
 * Campo de senha com botão para mostrar ou ocultar o valor e aviso de Caps Lock.
 * O botão mantém o nome "Mostrar senha" e informa o estado por aria-pressed, como recomenda o padrão de toggle button.
 */
export function PasswordField({ id, label, icon, hint, action, onKeyDown, onKeyUp, onBlur, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const hintId = hint ? `${id}-hint` : undefined
  const capsLockId = `${id}-caps-lock`
  const describedBy = [hintId, capsLock ? capsLockId : undefined].filter(Boolean).join(' ') || undefined

  const checkCapsLock = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState('CapsLock'))

  return <div className="field">
    <div className="field-head"><label htmlFor={id}>{label}</label>{action}</div>
    <span className={`input-wrap password-field${icon ? ' has-icon' : ''}`}>
      {icon && <Icon name={icon} className="input-icon" />}
      <input
        {...props}
        id={id}
        type={visible ? 'text' : 'password'}
        aria-describedby={describedBy}
        onKeyDown={(event) => { checkCapsLock(event); onKeyDown?.(event) }}
        onKeyUp={(event) => { checkCapsLock(event); onKeyUp?.(event) }}
        onBlur={(event) => { setCapsLock(false); onBlur?.(event) }}
      />
      <button type="button" className="password-toggle" aria-label="Mostrar senha" aria-pressed={visible} aria-controls={id} onClick={() => setVisible((current) => !current)}>
        <Icon name={visible ? 'eye-off' : 'eye'} />
      </button>
    </span>
    {hint && <small id={hintId} className="field-help">{hint}</small>}
    {capsLock && <p id={capsLockId} className="caps-lock-warning" role="status"><Icon name="alert" />Caps Lock está ativado.</p>}
  </div>
}
