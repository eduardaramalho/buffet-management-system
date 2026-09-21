import { describe, expect, it, jest } from '@jest/globals';
import { AuthController, authErrorStatus } from './AuthController.js';
import { AuthError } from '../../application/AuthService.js';
describe('AuthController', () => {
    it('logs in a user and responds with access and refresh tokens', async () => {
        const response = { json: jest.fn() };
        const service = {
            login: jest.fn(async () => ({ accessToken: 'token', refreshToken: 'refresh', user: { id: '1', name: 'Alice', email: 'alice@buffet.com' } })),
            refresh: jest.fn(async () => ({ accessToken: 'token2', refreshToken: 'refresh2', user: { id: '1', name: 'Alice', email: 'alice@buffet.com' } })),
            logout: jest.fn(async () => undefined),
            forgotPassword: jest.fn(async () => undefined),
            resetPassword: jest.fn(async () => undefined),
            me: jest.fn(async () => ({ id: '1', name: 'Alice', email: 'alice@buffet.com', roles: [] })),
        };
        const controller = new AuthController(service);
        await controller.login({ body: { email: 'alice@buffet.com', password: 'secret123' }, ip: '127.0.0.1' }, response);
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
            forgotPassword: jest.fn(async () => undefined),
            resetPassword: jest.fn(async () => undefined),
            me: jest.fn(async () => ({ id: '1', name: 'Alice', email: 'alice@buffet.com', roles: [] })),
        };
        const controller = new AuthController(service);
        await controller.refresh({ body: { refreshToken: 'abc' }, ip: '127.0.0.1' }, { json });
        await controller.logout({ body: { refreshToken: 'abc' } }, { status, send });
        expect(service.refresh).toHaveBeenCalledWith('abc', '127.0.0.1');
        expect(service.logout).toHaveBeenCalledWith('abc');
        expect(status).toHaveBeenCalledWith(204);
        expect(send).toHaveBeenCalled();
    });
    it('handles forgot and reset password and me route', async () => {
        const json = jest.fn();
        const status = jest.fn().mockReturnThis();
        const service = {
            login: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
            forgotPassword: jest.fn(async () => undefined),
            resetPassword: jest.fn(async () => undefined),
            me: jest.fn(async () => ({ id: '1', name: 'Alice', email: 'alice@buffet.com', roles: [] })),
        };
        const controller = new AuthController(service);
        await controller.forgotPassword({ body: { email: 'Alice@Buffet.com' } }, { json });
        await controller.resetPassword({ body: { token: 'token', password: 'password123' } }, { json });
        await controller.me({ user: { sub: '1' } }, { json });
        expect(service.forgotPassword).toHaveBeenCalledWith('Alice@Buffet.com');
        expect(service.resetPassword).toHaveBeenCalledWith('token', 'password123');
        expect(service.me).toHaveBeenCalledWith('1');
        expect(json).toHaveBeenCalledTimes(3);
    });
    it('returns 401 when me is called without a user id', async () => {
        const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const controller = new AuthController({ me: jest.fn() });
        await controller.me({ user: undefined }, response);
        expect(response.status).toHaveBeenCalledWith(401);
        expect(response.json).toHaveBeenCalledWith({ message: 'Não autenticado' });
    });
    it('maps authentication errors separately from validation errors', () => {
        expect(authErrorStatus(new AuthError())).toBe(401);
        expect(authErrorStatus(new Error('validation'))).toBe(400);
    });
});
