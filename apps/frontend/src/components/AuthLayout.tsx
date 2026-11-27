import type { ReactNode } from 'react'
import { Logo } from './Logo'

type AuthLayoutProps = {
  /** Frase de destaque do painel lateral. Não é um heading: o h1 da página fica no formulário. Sem título, o painel mostra só a marca, maior e centralizada. */
  title?: string
  description?: string
  aside?: ReactNode
  children: ReactNode
}

/**
 * Layout das telas fora do sistema (login e troca obrigatória de senha).
 * O painel lateral usa o mesmo navy da sidebar interna, para que a entrada no sistema não pareça outro produto.
 */
export function AuthLayout({ title, description, aside, children }: Readonly<AuthLayoutProps>) {
  return <div className="auth-shell">
    <aside className="auth-aside">
      {title ? <Logo /> : <div className="auth-aside-center"><Logo /></div>}
      {title && <div className="auth-aside-body">
        <span className="auth-aside-line" aria-hidden="true" />
        <p className="auth-aside-title">{title}</p>
        {description && <p className="auth-aside-text">{description}</p>}
        {aside}
      </div>}
      <small className="auth-aside-footer">© {new Date().getFullYear()} EventosPro</small>
    </aside>
    <main className="auth-main"><div className="auth-content">{children}</div></main>
  </div>
}
