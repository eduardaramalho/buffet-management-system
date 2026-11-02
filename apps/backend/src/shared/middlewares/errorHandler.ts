import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { AuthError } from "../../modules/auth/application/AuthService.js";
import { UserManagementError } from "../../modules/auth/application/UserService.js";
import { UserPasswordConflictError } from "../../modules/auth/application/UserPasswordService.js";
import { EventManagementError } from "../../modules/events/application/EventManagementService.js";
import { ServiceCatalogConflictError, ServiceCatalogError } from "../../modules/events/application/ServiceCatalogService.js";
import { EventReplicationConflictError, EventReplicationError } from "../../modules/events/application/EventReplicationService.js";
import { CollaboratorManagementError } from "../../modules/teams/application/CollaboratorService.js";
import { EventTeamManagementError } from "../../modules/teams/application/EventTeamService.js";
import { TeamManagementError } from "../../modules/teams/application/TeamService.js";
import { RuleManagementError } from "../../modules/rules/application/RuleEngineService.js";
import { RuleEngineExecutionError } from "../../modules/tasks/application/RuleEngineExecutionService.js";
import { TaskManagementError } from "../../modules/tasks/application/TaskService.js";
import { ClientConflictError, ClientManagementError } from "../../modules/clients/domain/client.errors.js";
import { NotFoundError } from "../errors/NotFoundError.js";
import { logger } from "../config/logger.js";

type ErrorClass = new (...args: never[]) => Error;

// Status per domain error, in a table instead of an if-chain: adding an error type is one line.
// Order matters only for subclasses; none of these classes extends another.
const STATUS_BY_ERROR: Array<[ErrorClass, number]> = [
  [NotFoundError, 404],
  [AuthError, 400],
  [UserManagementError, 403],
  [UserPasswordConflictError, 409],
  [ServiceCatalogConflictError, 409],
  [ServiceCatalogError, 400],
  [EventManagementError, 400],
  [EventReplicationError, 400],
  [TeamManagementError, 400],
  [CollaboratorManagementError, 400],
  [RuleManagementError, 400],
  [RuleEngineExecutionError, 400],
  [TaskManagementError, 400],
  [ClientConflictError, 409],
  [ClientManagementError, 400],
];

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  // Errors whose body or status depends on the instance.
  if (error instanceof EventReplicationConflictError) {
    return response.status(409).json({ message: error.message, conflicts: error.conflicts });
  }
  if (error instanceof EventTeamManagementError) {
    return response.status(error.message.startsWith("conflito") ? 409 : 400).json({ message: error.message });
  }
  if (error instanceof z.ZodError) {
    return response.status(422).json({ message: "Dados inválidos", issues: error.issues });
  }

  const mapped = STATUS_BY_ERROR.find(([errorClass]) => error instanceof errorClass);
  if (mapped) {
    // Código estável opcional (ex.: TEMP_PASSWORD_EXPIRED) para o frontend reagir sem comparar textos.
    const code = error instanceof AuthError ? error.code : undefined;
    return response.status(mapped[1]).json({ message: (error as Error).message, ...(code ? { code } : {}) });
  }

  logger.error({ err: error, requestId: request.id }, "Unhandled request error");
  return response.status(500).json({ message: "Erro interno do servidor" });
};