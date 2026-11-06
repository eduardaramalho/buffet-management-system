import { z } from 'zod'
import { onlyDigits } from '../utils/masks'

/**
 * Blocos de validação reaproveitados pelos schemas dos formulários. Os limites são os mesmos dos schemas Zod
 * do backend (apps/backend/src/modules/<módulo>/presentation); a API continua validando por conta própria.
 */
export const tooLong = (max: number) => `Use no máximo ${max} caracteres.`

export const requiredText = (message: string, max: number, min = 1) =>
  z.string().trim()
    .min(1, message)
    .min(min, `Use pelo menos ${min} caracteres.`)
    .max(max, tooLong(max))

export const optionalText = (max: number) => z.string().trim().max(max, tooLong(max))

export const requiredChoice = (message: string) => z.string().min(1, message)

const PHONE_LENGTHS = [10, 11]
const PHONE_MAX = 30

/** Opcional; quando preenchido, precisa ter DDD + número (a máscara monta o formato). */
export const optionalPhone = z.string().max(PHONE_MAX, tooLong(PHONE_MAX))
  .refine((value) => value === '' || PHONE_LENGTHS.includes(onlyDigits(value).length), 'Informe o telefone com DDD, por exemplo (47) 99999-0000.')

type IntegerOptions = { required?: string; min: number; max: number; minMessage?: string; maxMessage?: string }

/** Inteiro digitado como texto (campo com máscara). Vazio só é aceito quando o campo é opcional. */
export const integerText = ({ required, min, max, minMessage, maxMessage }: IntegerOptions) =>
  z.string().superRefine((value, context) => {
    if (value === '') {
      if (required) context.addIssue({ code: 'custom', message: required })
      return
    }
    const number = Number(value)
    if (!Number.isInteger(number)) context.addIssue({ code: 'custom', message: 'Informe um número inteiro.' })
    else if (number < min) context.addIssue({ code: 'custom', message: minMessage ?? `O valor mínimo é ${min}.` })
    else if (number > max) context.addIssue({ code: 'custom', message: maxMessage ?? `O valor máximo é ${max}.` })
  })

export const toOptionalNumber = (value: string) => (value === '' ? null : Number(value))
