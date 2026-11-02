import { describe, expect, it, jest } from '@jest/globals';
import { ZodError } from 'zod';

import { UserPasswordController } from './UserPasswordController.js';

const USER_ID = '6f1c2b7e-4d1a-4c1e-9b7a-2f3d4e5a6b7c';

describe('UserPasswordController', () => {
  it('resets the password and returns the temporary password with its expiration', async () => {
    const expiresAt = new Date('2026-10-28T12:00:00.000Z');
    const service = { resetByAdmin: jest.fn(async () => ({ temporaryPassword: 'Abcd2345efgh', expiresAt })) };
    const response: any = { json: jest.fn() };
    const controller = new UserPasswordController(service as any);

    await controller.reset({ user: { sub: 'admin-1' }, params: { id: USER_ID } } as any, response);

    expect(service.resetByAdmin).toHaveBeenCalledWith(USER_ID, 'admin-1');
    expect(response.json).toHaveBeenCalledWith({ temporaryPassword: 'Abcd2345efgh', expiresAt });
  });

  it('rejects an invalid user id with a validation error', async () => {
    const controller = new UserPasswordController({ resetByAdmin: jest.fn() } as any);

    await expect(controller.reset({ user: { sub: 'admin-1' }, params: { id: 'nao-e-uuid' } } as any, { json: jest.fn() } as any)).rejects.toBeInstanceOf(ZodError);
  });

  it('returns 401 without an authenticated actor', async () => {
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const controller = new UserPasswordController({ resetByAdmin: jest.fn() } as any);

    await controller.reset({ user: undefined, params: { id: USER_ID } } as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
  });
});
