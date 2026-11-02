import { randomInt } from "node:crypto";
import type { TemporaryPasswordGenerator } from "../../domain/user-management.types.js";
import { TEMPORARY_PASSWORD_LENGTH } from "../../domain/password.policy.js";

// Sem 0/O, 1/l/I: a senha costuma ser ditada ou copiada à mão pelo administrador.
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALL = UPPERCASE + LOWERCASE + DIGITS;

const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)];

/** Usa crypto.randomInt (CSPRNG) em vez de Math.random, que é previsível. */
export class CryptoTemporaryPasswordGenerator implements TemporaryPasswordGenerator {
  generate() {
    const characters = [pick(UPPERCASE), pick(LOWERCASE), pick(DIGITS)];
    while (characters.length < TEMPORARY_PASSWORD_LENGTH) characters.push(pick(ALL));
    // Fisher-Yates: as classes obrigatórias não ficam sempre nas três primeiras posições.
    for (let index = characters.length - 1; index > 0; index -= 1) {
      const swap = randomInt(index + 1);
      [characters[index], characters[swap]] = [characters[swap], characters[index]];
    }
    return characters.join("");
  }
}
