/** Regras de senha compartilhadas pelo login, pela troca de senha e pela redefinição administrativa (ADR 0012). */
export const PASSWORD_MIN_LENGTH = 8;

/** A senha temporária gerada pelo administrador vale por 24h; depois disso só uma nova redefinição libera o acesso. */
export const TEMPORARY_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;

/** 12 caracteres sem símbolos ambíguos: fácil de ditar ao usuário e acima do mínimo da política. */
export const TEMPORARY_PASSWORD_LENGTH = 12;

/** Códigos estáveis devolvidos no corpo do erro para o frontend reagir sem depender do texto da mensagem. */
export const AUTH_ERROR_CODES = {
  TEMP_PASSWORD_EXPIRED: "TEMP_PASSWORD_EXPIRED",
  PASSWORD_CHANGE_REQUIRED: "PASSWORD_CHANGE_REQUIRED"
} as const;
