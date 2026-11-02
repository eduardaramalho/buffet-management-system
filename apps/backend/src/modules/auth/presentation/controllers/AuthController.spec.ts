import { describe, expect, it, jest } from '@jest/globals';

import { AuthController, authErrorStatus } from './AuthController.js';
import { AuthError } from '../../application/AuthService.js';
import { ZodError } from 'zod';

describe('AuthController', () => {
  it('logs in a user and responds with access and refresh tokens', async () => {
    const response: any = { json: jest.fn() };
    const service = {
      login: jest.fn(async () => ({ accessToken: 'token', refreshToken: 'refresh', user: { id: '1', name: 'Alice', email: 'alice@buffet.com' } })),
      refresh: jest.fn(async () => ({ accessToken: 'token2', refreshToken: 'refresh2', user: { id: '1', name: 'Alice', email: 'alice@buffet.com' } })),
      logout: jest.fn(async () => undefined),
      me: jest.fn(async () => ({ id: '1', name: 'Alice', email: 'alice@buffet.com', roles: [] })),
    };

    const controller = new AuthController(service as any);
    await controller.login({ body: { email: 'alice@buffet.com', password: 'secret123' }, ip: '127.0.0.1' } as any, response);

    expect(service.login).toHaveBeenCalledWith('alice@buffet.com', 'secret123', '127.0.0.1');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'token' }));
  });

  it('refreshes a token and returns 204 on logout', async () => {
    const json = jest.fn();
    const send = jest.fn();
    const status = jest.fn().mockReturnThis();
    const service = {
      login: jest.fn(),
      refresh: jest.fn(async () => ({ accessToken: 'token2', refreshToken: 'refresh2', user: { id: '1', name: 'Alice', email: 'alice@buffet.com' } })),
      logout: jest.fn(async () => undefined),
      me: jest.fn(async () => ({ id: '1', name: 'Alice', email: 'alice@buffet.com', roles: [] })),
    };
    const controller = new AuthController(service as any);

    await controller.refresh({ body: { refreshToken: 'abc' }, ip: '127.0.0.1' } as any, { json } as any);
    await controller.logout({ body: { refreshToken: 'abc' } } as any, { status, send } as any);

    expect(service.refresh).toHaveBeenCalledWith('abc', '127.0.0.1');
    expect(service.logout).toHaveBeenCalledWith('abc');
    expect(status).toHaveBeenCalledWith(204);
    expect(send).toHaveBeenCalled();
  });

  it('returns the profile of the authenticated user', async () => {
    const json = jest.fn();
    const service = { me: jest.fn(async () => ({ id: '1', name: 'Alice', email: 'alice@buffet.com', mustChangePassword: false, roles: [] })) };
    const controller = new AuthController(service as any);

    await controller.me({ user: { sub: '1' } } as any, { json } as any);

    expect(service.me).toHaveBeenCalledWith('1');
    expect(json).toHaveBeenCalledTimes(1);
  });

  it('changes the password of the authenticated user and returns the new session', async () => {
    const json = jest.fn();
    const session = { accessToken: 'a', refreshToken: 'r', user: { id: '1', name: 'Alice', email: 'alice@buffet.com', mustChangePassword: false } };
    const service = { changePassword: jest.fn(async () => session) };
    const controller = new AuthController(service as any);

    await controller.changePassword(
      { user: { sub: '1' }, ip: '127.0.0.1', body: { currentPassword: 'Temp2345abcd', newPassword: 'NovaSenha123' } } as any,
      { json } as any,
    );

    expect(service.changePassword).toHaveBeenCalledWith('1', 'Temp2345abcd', 'NovaSenha123', '127.0.0.1');
    expect(json).toHaveBeenCalledWith(session);
  });

  it('rejects a new password that is too short or equal to the current one', async () => {
    const controller = new AuthController({ changePassword: jest.fn() } as any);
    const call = (body: object) => controller.changePassword({ user: { sub: '1' }, body } as any, { json: jest.fn() } as any);

    await expect(call({ currentPassword: 'Temp2345abcd', newPassword: 'curta' })).rejects.toBeInstanceOf(ZodError);
    await expect(call({ currentPassword: 'MesmaSenha1', newPassword: 'MesmaSenha1' })).rejects.toBeInstanceOf(ZodError);
    await expect(call({ newPassword: 'NovaSenha123' })).rejects.toBeInstanceOf(ZodError);
  });

  it('returns 401 when the password change is called without a user id', async () => {
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const controller = new AuthController({ changePassword: jest.fn() } as any);

    await controller.changePassword({ user: undefined, body: {} } as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when me is called without a user id', async () => {
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const controller = new AuthController({ me: jest.fn() } as any);

    await controller.me({ user: undefined } as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: 'Não autenticado' });
  });

  it('maps authentication errors separately from validation errors', () => {
    expect(authErrorStatus(new AuthError())).toBe(401);
    expect(authErrorStatus(new Error('validation'))).toBe(400);
  });
});
