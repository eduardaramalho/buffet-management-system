import { beforeAll, describe, expect, it, jest } from '@jest/globals';

const mockVerifyAccessToken = jest.fn();
const mockHasPermission = jest.fn();

jest.unstable_mockModule('../../infrastructure/factories/auth.factory.js', () => ({
  tokenProvider: { verifyAccessToken: mockVerifyAccessToken },
  authService: { hasPermission: mockHasPermission },
}));

const { authenticate } = await import('./authenticate.js');
const { authorize } = await import('./authorize.js');

describe('Auth middlewares', () => {
  beforeAll(() => {
    mockVerifyAccessToken.mockReset();
    mockHasPermission.mockReset();
  });

  it('rejects requests without a bearer token', () => {
    const request: any = { header: jest.fn(() => undefined) };
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();

    authenticate(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: 'Não autenticado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the user to the request when the token is valid', () => {
    const request: any = { header: jest.fn(() => 'Bearer valid-token') };
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    mockVerifyAccessToken.mockReturnValue({ sub: 'user-1', email: 'alice@buffet.com' });

    authenticate(request, response, next);

    expect(request.user).toEqual({ sub: 'user-1', email: 'alice@buffet.com' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows access only when the user has the required permission', async () => {
    const request: any = { user: { sub: 'user-1' } };
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    mockHasPermission.mockResolvedValue(true);

    await authorize('users:list')(request, response, next);

    expect(mockHasPermission).toHaveBeenCalledWith('user-1', 'users:list');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when permission is missing', async () => {
    const request: any = { user: { sub: 'user-1' } };
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    mockHasPermission.mockResolvedValue(false);

    await authorize('users:list')(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ message: 'Permissão insuficiente' });
    expect(next).not.toHaveBeenCalled();
  });
});
