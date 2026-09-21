import { describe, expect, it } from '@jest/globals';
import jwt from 'jsonwebtoken';

import { BcryptHasher } from '../infrastructure/providers/BcryptHasher.js';
import { JwtTokenProvider } from '../infrastructure/providers/JwtTokenProvider.js';

describe('Auth providers', () => {
  it('hashes and compares passwords with bcrypt', async () => {
    const hasher = new BcryptHasher(1);
    const value = 'Password123';

    const hash = await hasher.hash(value);

    expect(hash).not.toBe(value);
    expect(await hasher.compare(value, hash)).toBe(true);
    expect(await hasher.compare('wrong', hash)).toBe(false);
  });

  it('creates and verifies access tokens', () => {
    const provider = new JwtTokenProvider('test-secret', '5m');
    const token = provider.createAccessToken({ sub: 'user-1', email: 'alice@buffet.com' });

    expect(provider.verifyAccessToken(token)).toEqual({ sub: 'user-1', email: 'alice@buffet.com' });
    expect(() => provider.verifyAccessToken('not-a-token')).toThrow();
    expect(() => provider.verifyAccessToken(jwt.sign({ sub: 'user-1' }, 'test-secret'))).toThrow('Token inválido');
  });

  it('uses the default bcrypt cost when no rounds are provided', async () => {
    const hasher = new BcryptHasher();
    const hash = await hasher.hash('Password123');

    expect(await hasher.compare('Password123', hash)).toBe(true);
  });
});
