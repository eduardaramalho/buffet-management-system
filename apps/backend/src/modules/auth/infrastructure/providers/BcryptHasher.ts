import bcrypt from "bcryptjs";
import type { PasswordHasher } from "../../domain/auth.types.js";

export class BcryptHasher implements PasswordHasher {
  constructor(private readonly rounds = 12) {}

  hash(value: string) {
    return bcrypt.hash(value, this.rounds);
  }

  compare(value: string, hashedValue: string) {
    return bcrypt.compare(value, hashedValue);
  }
}