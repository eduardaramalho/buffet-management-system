import { describe, expect, it } from '@jest/globals';

import { CryptoTemporaryPasswordGenerator } from './CryptoTemporaryPasswordGenerator.js';
import { PASSWORD_MIN_LENGTH, TEMPORARY_PASSWORD_LENGTH } from '../../domain/password.policy.js';

const SAMPLES = 200;
const AMBIGUOUS = /[0O1lI]/;

describe('CryptoTemporaryPasswordGenerator', () => {
  const generator = new CryptoTemporaryPasswordGenerator();
  const samples = Array.from({ length: SAMPLES }, () => generator.generate());

  it('generates passwords with the configured length, above the policy minimum', () => {
    expect(TEMPORARY_PASSWORD_LENGTH).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
    for (const password of samples) expect(password).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
  });

  it('uses only letters and digits that cannot be confused when dictated', () => {
    for (const password of samples) {
      expect(password).toMatch(/^[A-Za-z0-9]+$/);
      expect(password).not.toMatch(AMBIGUOUS);
    }
  });

  it('always mixes uppercase, lowercase and digits', () => {
    for (const password of samples) {
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
    }
  });

  it('does not repeat passwords', () => {
    expect(new Set(samples).size).toBe(SAMPLES);
  });
});
