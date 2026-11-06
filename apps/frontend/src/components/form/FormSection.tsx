import { useId, type ReactNode } from 'react'

type FormSectionProps = { title: string; description?: string; active: boolean; children: ReactNode }

/**
 * Seção de um formulário longo. As inativas continuam montadas (o estado é preservado e a validação
 * enxerga todos os campos), mas ficam ocultas com hidden, fora da ordem de Tab.
 */
export function FormSection({ title, description, active, children }: FormSectionProps) {
  const id = useId()
  return <section className="fm-section" hidden={!active} aria-labelledby={id}>
    <div className="fm-section-head"><h3 id={id}>{title}</h3>{description && <p>{description}</p>}</div>
    {children}
  </section>
}
