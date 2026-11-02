import { beforeAll, describe, expect, it, jest } from '@jest/globals';

const mockVerifyAccessToken = jest.fn();
const mockHasPermission = jest.fn();

jest.unstable_mockModule('../../infrastructure/factories/auth.factory.js', () => ({
  tokenProvider: { verifyAccessToken: mockVerifyAccessToken },
  authService: { hasPermission: mockHasPermission },
}));

const { authenticate, authenticateAllowingPasswordChange } = await import('./authenticate.js');
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

  it('blocks every protected route while the user still has to change a temporary password', () => {
    const request: any = { header: jest.fn(() => 'Bearer valid-token') };
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    mockVerifyAccessToken.mockReturnValue({ sub: 'user-1', email: 'alice@buffet.com', mustChangePassword: true });

    authenticate(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Troque sua senha temporária para continuar',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('lets the pending user reach only the routes that allow the password change', () => {
    const request: any = { header: jest.fn(() => 'Bearer valid-token') };
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    mockVerifyAccessToken.mockReturnValue({ sub: 'user-1', email: 'alice@buffet.com', mustChangePassword: true });

    authenticateAllowingPasswordChange(request, response, next);

    expect(request.user).toEqual({ sub: 'user-1', email: 'alice@buffet.com', mustChangePassword: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid token on the routes that allow the password change', () => {
    const request: any = { header: jest.fn(() => 'Bearer broken') };
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    mockVerifyAccessToken.mockImplementation(() => { throw new Error('bad'); });

    authenticateAllowingPasswordChange(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    mockVerifyAccessToken.mockReset();
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

  it('returns 401 when authorization runs without an authenticated user', async () => {
    const request: any = { user: undefined };
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();

    await authorize('users:list')(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
