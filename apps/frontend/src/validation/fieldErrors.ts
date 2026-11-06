import type { z } from 'zod'

/** Erros por campo, com a chave no formato do caminho do Zod ("name", "taskTemplates.0.title"). */
export type FieldErrors = Record<string, string>

/** Converte o erro do Zod em uma mensagem por campo, mantendo a primeira regra violada de cada um. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.')
    if (!(key in errors)) errors[key] = issue.message
  }
  return errors
}

/** Indica se algum erro pertence a um dos campos (ou a um item de lista, como "taskTemplates.0.title"). */
export const hasErrorIn = (errors: FieldErrors, fields: readonly string[]) =>
  Object.keys(errors).some((key) => fields.some((field) => key === field || key.startsWith(`${field}.`)))
