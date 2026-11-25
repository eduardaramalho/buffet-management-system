import { describe, expect, it, jest } from '@jest/globals';

import { AuthController, authErrorStatus } from './AuthController.js';
import { AuthError, type AuthService } from '../../application/AuthService.js';
import { REFRESH_TOKEN_COOKIE_NAME, RefreshTokenCookie } from '../refreshTokenCookie.js';
import { ZodError } from 'zod';

const user = { id: '1', name: 'Alice', email: 'alice@buffet.com', mustChangePassword: false };
const cookie = new RefreshTokenCookie({ secure: true, maxAgeMs: 1000 });
const fakeResponse = () => {
  const response: any = { json: jest.fn(), send: jest.fn(), cookie: jest.fn(), clearCookie: jest.fn() };
  response.status = jest.fn(() => response);
  return response;
};
const withCookie = (token?: string) => ({ cookies: token === undefined ? {} : { [REFRESH_TOKEN_COOKIE_NAME]: token } });

describe('AuthController', () => {
  it('logs in, keeps the refresh token in the cookie and leaves it out of the body', async () => {
    const response = fakeResponse();
    const service = { login: jest.fn<AuthService['login']>(async () => ({ accessToken: 'token', refreshToken: 'refresh', user })) };

    await new AuthController(service as any, cookie).login({ body: { email: 'alice@buffet.com', password: 'secret123' }, ip: '127.0.0.1' } as any, response);

    expect(service.login).toHaveBeenCalledWith('alice@buffet.com', 'secret123', '127.0.0.1');
    expect(response.cookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, 'refresh', expect.objectContaining({ httpOnly: true }));
    expect(response.json).toHaveBeenCalledWith({ accessToken: 'token', user });
  });

  it('refreshes with the token read from the cookie and rotates it', async () => {
    const response = fakeResponse();
    const service = { refresh: jest.fn<AuthService['refresh']>(async () => ({ accessToken: 'token2', refreshToken: 'refresh2', user })) };

    await new AuthController(service as any, cookie).refresh({ ...withCookie('abc'), ip: '127.0.0.1' } as any, response);

    expect(service.refresh).toHaveBeenCalledWith('abc', '127.0.0.1');
    expect(response.cookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, 'refresh2', expect.anything());
    expect(response.json).toHaveBeenCalledWith({ accessToken: 'token2', user });
  });

  it('rejects a refresh without the cookie and clears any leftover cookie', async () => {
    const response = fakeResponse();
    const service = { refresh: jest.fn() };

    await expect(new AuthController(service as any, cookie).refresh({ ...withCookie(), ip: '127.0.0.1' } as any, response)).rejects.toBeInstanceOf(AuthError);

    expect(service.refresh).not.toHaveBeenCalled();
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, expect.anything());
  });

  it('clears the cookie when the refresh token is rejected, so the browser stops sending a dead token', async () => {
    const response = fakeResponse();
    const service = { refresh: jest.fn<AuthService['refresh']>(async () => { throw new AuthError('Refresh token inválido'); }) };

    await expect(new AuthController(service as any, cookie).refresh({ ...withCookie('revoked'), ip: '127.0.0.1' } as any, response)).rejects.toThrow('Refresh token inválido');

    expect(response.clearCookie).toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('keeps the cookie when the refresh fails for a reason other than authentication', async () => {
    const response = fakeResponse();
    const service = { refresh: jest.fn<AuthService['refresh']>(async () => { throw new Error('banco indisponível'); }) };

    await expect(new AuthController(service as any, cookie).refresh({ ...withCookie('abc') } as any, response)).rejects.toThrow('banco indisponível');

    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('revokes the session of the cookie on logout, clears it and returns 204', async () => {
    const response = fakeResponse();
    const service = { logout: jest.fn<AuthService['logout']>(async () => undefined) };

    await new AuthController(service as any, cookie).logout(withCookie('abc') as any, response);

    expect(service.logout).toHaveBeenCalledWith('abc');
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, expect.anything());
    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.send).toHaveBeenCalled();
  });

  it('still clears the cookie and returns 204 on logout without a cookie', async () => {
    const response = fakeResponse();
    const service = { logout: jest.fn() };

    await new AuthController(service as any, cookie).logout(withCookie() as any, response);

    expect(service.logout).not.toHaveBeenCalled();
    expect(response.clearCookie).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it('returns the profile of the authenticated user', async () => {
    const response = fakeResponse();
    const service = { me: jest.fn<AuthService['me']>(async () => ({ ...user, roles: [] })) };

    await new AuthController(service as any, cookie).me({ user: { sub: '1' } } as any, response);

    expect(service.me).toHaveBeenCalledWith('1');
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  it('changes the password and returns the new session with the refresh token only in the cookie', async () => {
    const response = fakeResponse();
    const service = { changePassword: jest.fn<AuthService['changePassword']>(async () => ({ accessToken: 'a', refreshToken: 'r', user })) };

    await new AuthController(service as any, cookie).changePassword(
      { user: { sub: '1' }, ip: '127.0.0.1', body: { currentPassword: 'Temp2345abcd', newPassword: 'NovaSenha123' } } as any,
      response,
    );

    expect(service.changePassword).toHaveBeenCalledWith('1', 'Temp2345abcd', 'NovaSenha123', '127.0.0.1');
    expect(response.cookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, 'r', expect.anything());
    expect(response.json).toHaveBeenCalledWith({ accessToken: 'a', user });
  });

  it('rejects a new password that is too short or equal to the current one', async () => {
    const controller = new AuthController({ changePassword: jest.fn() } as any, cookie);
    const call = (body: object) => controller.changePassword({ user: { sub: '1' }, body } as any, fakeResponse());

    await expect(call({ currentPassword: 'Temp2345abcd', newPassword: 'curta' })).rejects.toBeInstanceOf(ZodError);
    await expect(call({ currentPassword: 'MesmaSenha1', newPassword: 'MesmaSenha1' })).rejects.toBeInstanceOf(ZodError);
    await expect(call({ newPassword: 'NovaSenha123' })).rejects.toBeInstanceOf(ZodError);
  });

  it('returns 401 when the password change is called without a user id', async () => {
    const response = fakeResponse();

    await new AuthController({ changePassword: jest.fn() } as any, cookie).changePassword({ user: undefined, body: {} } as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when me is called without a user id', async () => {
    const response = fakeResponse();

    await new AuthController({ me: jest.fn() } as any, cookie).me({ user: undefined } as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: 'Não autenticado' });
  });

  it('maps authentication errors separately from validation errors', () => {
    expect(authErrorStatus(new AuthError())).toBe(401);
    expect(authErrorStatus(new Error('validation'))).toBe(400);
  });
});
