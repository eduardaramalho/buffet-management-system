import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../Icon'
import { Notice } from '../Notice'

export type FormModalSection = {
  id: string
  label: string
  /** Resumo curto do que já foi preenchido, exibido abaixo do nome da seção. */
  description?: string
  complete?: boolean
  invalid?: boolean
}

type FormModalProps = {
  title: string
  subtitle?: ReactNode
  icon: ReactNode
  /** Ícone em círculo, usado quando o ícone é a inicial de uma pessoa. */
  roundIcon?: boolean
  onClose: () => void
  onSubmit: () => void | Promise<void>
  submitting: boolean
  submitLabel: string
  /** Erro devolvido pela API ao salvar; os erros de campo ficam junto de cada campo. */
  error?: string
  sections?: FormModalSection[]
  activeSection?: string
  onSectionChange?: (id: string) => void
  /** Conteúdo extra no rodapé da navegação lateral (por exemplo, o resumo de uma regra). */
  railFooter?: ReactNode
  /** Incrementado a cada tentativa de envio com erro: o foco vai para o primeiro campo inválido. */
  invalidAttempt?: number
  children: ReactNode
}

const FIELD_SELECTOR = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
const FOCUSABLE_SELECTOR = `a[href], button:not([disabled]), ${FIELD_SELECTOR}, [tabindex]:not([tabindex="-1"])`

const visibleIn = (root: HTMLElement | null, selector: string) =>
  Array.from(root?.querySelectorAll<HTMLElement>(selector) ?? []).filter((element) => !element.closest('[hidden]'))

/**
 * Modal centralizado padrão dos formulários (Modelo B do estudo de UX).
 * - Cancelar e Salvar ficam sempre no canto direito do rodapé; a navegação entre seções fica à esquerda.
 * - Enter envia (é um <form>), Esc fecha, Tab circula só dentro do modal e o foco volta para quem abriu.
 * - É renderizado em portal no <body>, então um modal aberto de dentro de outro fica por cima sem herdar layout.
 */
export function FormModal({ title, subtitle, icon, roundIcon = false, onClose, onSubmit, submitting, submitLabel, error, sections, activeSection, onSectionChange, railFooter, invalidAttempt = 0, children }: FormModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const activeIndex = sections ? Math.max(0, sections.findIndex((section) => section.id === activeSection)) : 0

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  // Ao abrir e ao trocar de seção, o foco vai para o primeiro campo visível.
  useEffect(() => {
    const [first] = visibleIn(bodyRef.current, FIELD_SELECTOR)
    ;(first ?? dialogRef.current)?.focus()
  }, [activeSection])

  // Depois de uma tentativa inválida, o foco vai para o primeiro campo com erro (já na seção certa).
  useEffect(() => {
    if (invalidAttempt === 0) return
    const [firstInvalid] = visibleIn(bodyRef.current, '[aria-invalid="true"]')
    firstInvalid?.focus()
  }, [invalidAttempt])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      if (!submitting) onClose()
      return
    }
    if (event.key !== 'Tab') return
    event.stopPropagation()
    const focusable = visibleIn(dialogRef.current, FOCUSABLE_SELECTOR)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  const goTo = (index: number) => sections && onSectionChange?.(sections[index].id)

  return createPortal(<div className="fm-backdrop">
    <div ref={dialogRef} className={`fm-dialog ${sections ? 'fm-lg' : 'fm-sm'}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={handleKeyDown}>
      <form className="fm-form" noValidate onSubmit={(event) => { event.preventDefault(); void onSubmit() }}>
        <header className="fm-head">
          <span className={`fm-icon${roundIcon ? ' round' : ''}`} aria-hidden="true">{icon}</span>
          <div className="fm-title"><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button type="button" className="fm-close" aria-label="Fechar" onClick={onClose} disabled={submitting}><Icon name="x" /></button>
        </header>
        <div className="fm-main">
          {sections && <nav className="fm-rail" aria-label="Seções do formulário">
            <span className="fm-rail-title">Seções</span>
            {sections.map((section, index) => {
              const current = index === activeIndex
              const state = current ? 'current' : section.invalid ? 'invalid' : section.complete ? 'done' : ''
              return <button key={section.id} type="button" className={`fm-step ${state}`} aria-current={current ? 'step' : undefined} onClick={() => goTo(index)}>
                <span className="fm-dot" aria-hidden="true">{section.invalid && !current ? '!' : section.complete && !current ? <Icon name="check" /> : index + 1}</span>
                <span className="fm-step-text"><strong>{section.label}</strong>{section.description && <small>{section.description}</small>}{section.invalid && <span className="sr-only"> (contém erros)</span>}</span>
              </button>
            })}
            {railFooter && <div className="fm-rail-footer">{railFooter}</div>}
          </nav>}
          <div ref={bodyRef} className="fm-body">
            {error && <Notice message={error} error />}
            {children}
          </div>
        </div>
        <footer className="fm-foot">
          {sections
            ? <>
              <span className="fm-meta">Seção {activeIndex + 1} de {sections.length}</span>
              {activeIndex > 0 && <button type="button" className="fm-btn fm-btn-secondary" onClick={() => goTo(activeIndex - 1)}>Seção anterior</button>}
              {activeIndex < sections.length - 1 && <button type="button" className="fm-btn fm-btn-secondary" onClick={() => goTo(activeIndex + 1)}>Próxima seção</button>}
            </>
            : <span className="fm-meta"><span className="fm-req" aria-hidden="true">*</span> obrigatório</span>}
          <span className="fm-spacer" />
          <button type="button" className="fm-btn fm-btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
          <button type="submit" className="fm-btn fm-btn-primary" disabled={submitting} aria-busy={submitting}>
            {submitting && <span className="fm-spinner" aria-hidden="true" />}
            {submitting ? 'Salvando...' : submitLabel}
          </button>
        </footer>
      </form>
    </div>
  </div>, document.body)
}
