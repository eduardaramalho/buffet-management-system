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

  it('maps every domain error to its HTTP status', async () => {
    const { NotFoundError } = await import('../errors/NotFoundError.js');
    const { UserManagementError } = await import('../../modules/auth/application/UserService.js');
    const { EventManagementError } = await import('../../modules/events/application/EventManagementService.js');
    const { ServiceCatalogConflictError, ServiceCatalogError } = await import('../../modules/events/application/ServiceCatalogService.js');
    const { EventTeamManagementError } = await import('../../modules/teams/application/EventTeamService.js');
    const { TeamManagementError } = await import('../../modules/teams/application/TeamService.js');
    const { CollaboratorManagementError } = await import('../../modules/teams/application/CollaboratorService.js');
    const { RuleManagementError } = await import('../../modules/rules/application/RuleEngineService.js');
    const { RuleEngineExecutionError } = await import('../../modules/tasks/application/RuleEngineExecutionService.js');
    const { TaskManagementError } = await import('../../modules/tasks/application/TaskService.js');
    const { ClientConflictError, ClientManagementError } = await import('../../modules/clients/domain/client.errors.js');
    const cases: Array<[Error, number]> = [
      [new NotFoundError('x'), 404], [new UserManagementError('x'), 403], [new EventManagementError('x'), 400],
      [new ServiceCatalogConflictError('x'), 409], [new ServiceCatalogError('x'), 400],
      [new EventTeamManagementError('conflito de agenda'), 409], [new EventTeamManagementError('Equipe inativa'), 400],
      [new TeamManagementError('x'), 400], [new CollaboratorManagementError('x'), 400], [new RuleManagementError('x'), 400],
      [new RuleEngineExecutionError('x'), 400], [new TaskManagementError('x'), 400],
      [new ClientConflictError('x'), 409], [new ClientManagementError('x'), 400],
    ];
    for (const [error, status] of cases) {
      const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      errorHandler(error, {} as any, response, jest.fn());
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.json).toHaveBeenCalledWith({ message: error.message });
    }
  });
});
