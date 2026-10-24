import { describe, expect, it, jest } from '@jest/globals';
import { z } from 'zod';

import { AuthError } from '../../modules/auth/application/AuthService.js';
import { errorHandler } from './errorHandler.js';
import { EventReplicationConflictError, EventReplicationError } from '../../modules/events/application/EventReplicationService.js';

describe('errorHandler', () => {
  it('maps AuthError to 400 bad request', () => {
    const request: any = {};
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    errorHandler(new AuthError('Credenciais inválidas'), request, response, jest.fn());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: 'Credenciais inválidas' });
  });

  it('maps zod validation errors to 422', () => {
    const request: any = {};
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const issues = z.object({ email: z.string().email() }).safeParse({ email: 'invalid' });

    if (issues.success) throw new Error('Unexpected parse success');

    errorHandler(issues.error, request, response, jest.fn());

    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Dados inválidos' }));
  });

  it('returns 500 for unexpected errors', () => {
    const request: any = {};
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    errorHandler(new Error('boom'), request, response, jest.fn());

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ message: 'Erro interno do servidor' });
  });

  it('maps replication errors: business rule to 400 and unavailable teams to 409 with details (RF25)', () => {
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const conflicts = [{ teamId: 'team-1', reason: 'INACTIVE' as const, conflictingEvent: null }];

    errorHandler(new EventReplicationError('Tarefa repetida'), {} as any, response, jest.fn());
    errorHandler(new EventReplicationConflictError(conflicts), {} as any, response, jest.fn());

    expect(response.status).toHaveBeenNthCalledWith(1, 400);
    expect(response.json).toHaveBeenNthCalledWith(1, { message: 'Tarefa repetida' });
    expect(response.status).toHaveBeenNthCalledWith(2, 409);
    expect(response.json).toHaveBeenNthCalledWith(2, { message: 'Há equipes indisponíveis para a nova data', conflicts });
  });
});
