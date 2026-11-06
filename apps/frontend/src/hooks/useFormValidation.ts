import { useState } from 'react'
import type { z } from 'zod'
import { toFieldErrors, type FieldErrors } from '../validation/fieldErrors'

/**
 * Valida os valores do formulário com um schema Zod a cada renderização.
 * O erro de um campo só aparece depois que a pessoa sai dele (touch) ou tenta salvar (submit),
 * para não acusar erro em campo que ainda nem foi preenchido.
 */
export function useFormValidation<Schema extends z.ZodType>(schema: Schema, values: z.input<Schema>) {
  const [touched, setTouched] = useState<Record<string, true>>({})
  const [submitted, setSubmitted] = useState(false)
  const [invalidAttempt, setInvalidAttempt] = useState(0)
  const result = schema.safeParse(values)
  const errors: FieldErrors = result.success ? {} : toFieldErrors(result.error)

  return {
    /** Todos os erros atuais, visíveis ou não (usado para marcar as seções do modal). */
    errors,
    submitted,
    /** Cresce a cada envio com erro; o FormModal usa para focar o primeiro campo inválido. */
    invalidAttempt,
    errorFor: (field: string) => (submitted || touched[field] ? errors[field] : undefined),
    /**
     * Marca o campo como visitado (chamado no blur). Um blur causado por trocar de seção não conta:
     * o campo some da tela sem a pessoa ter terminado de preenchê-lo.
     */
    touch: (field: string, target?: EventTarget | null) => {
      if (target instanceof Element && target.closest('[hidden]')) return
      setTouched((current) => (current[field] ? current : { ...current, [field]: true }))
    },
    /** Marca a tentativa de envio e devolve os dados válidos, ou null quando há erro. */
    submit: (): z.output<Schema> | null => {
      setSubmitted(true)
      if (result.success) return result.data
      setInvalidAttempt((current) => current + 1)
      return null
    },
  }
}
