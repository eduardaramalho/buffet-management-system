import type { ClientType } from "./client.types.js";

const CPF_PATTERN = /^\d{11}$/;
// Since July 2026 the Receita Federal issues alphanumeric CNPJs: 12 chars [0-9A-Z] + 2 numeric check digits.
// Numeric CNPJs remain valid and follow the same algorithm, so a single validator covers both.
const CNPJ_PATTERN = /^[0-9A-Z]{12}\d{2}$/;
const REPEATED_CHAR_PATTERN = /^(.)\1+$/;
const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const ASCII_ZERO = 48;

export const normalizeDocument = (value: string) => value.replace(/[.\-/\s]/g, "").toUpperCase();

const mod11Digit = (sum: number) => {
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
};

const cpfDigit = (digits: string, firstWeight: number) =>
  mod11Digit([...digits].reduce((sum, digit, index) => sum + Number(digit) * (firstWeight - index), 0));

export function isValidCpf(value: string): boolean {
  if (!CPF_PATTERN.test(value) || REPEATED_CHAR_PATTERN.test(value)) return false;
  const first = cpfDigit(value.slice(0, 9), 10);
  const second = cpfDigit(value.slice(0, 9) + first, 11);
  return value.endsWith(`${first}${second}`);
}

// Each character is worth its ASCII code minus 48 (digits keep their value, A = 17 ... Z = 42).
const cnpjDigit = (chars: string, weights: number[]) =>
  mod11Digit([...chars].reduce((sum, char, index) => sum + (char.charCodeAt(0) - ASCII_ZERO) * weights[index], 0));

export function isValidCnpj(value: string): boolean {
  if (!CNPJ_PATTERN.test(value) || REPEATED_CHAR_PATTERN.test(value)) return false;
  const first = cnpjDigit(value.slice(0, 12), CNPJ_FIRST_WEIGHTS);
  const second = cnpjDigit(value.slice(0, 12) + first, CNPJ_SECOND_WEIGHTS);
  return value.endsWith(`${first}${second}`);
}

export const isValidDocument = (type: ClientType, document: string) => (type === "PF" ? isValidCpf(document) : isValidCnpj(document));
