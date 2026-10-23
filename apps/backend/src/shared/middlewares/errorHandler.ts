import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { AuthError } from "../../modules/auth/application/AuthService.js";
import { UserManagementError } from "../../modules/auth/application/UserService.js";
import { EventManagementError } from "../../modules/events/application/EventManagementService.js";
import { ServiceCatalogError } from "../../modules/events/application/ServiceCatalogService.js";
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

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof NotFoundError) return response.status(404).json({ message: error.message });
  if (error instanceof AuthError) return response.status(400).json({ message: error.message });
  if (error instanceof UserManagementError) return response.status(403).json({ message: error.message });
  if (error instanceof EventManagementError || error instanceof ServiceCatalogError) return response.status(400).json({ message: error.message });
  if (error instanceof EventReplicationConflictError) {
    return response.status(409).json({ message: error.message, conflicts: error.conflicts });
  }
  if (error instanceof EventReplicationError) return response.status(400).json({ message: error.message });
  if (error instanceof EventTeamManagementError) {
    return response.status(error.message.startsWith("conflito") ? 409 : 400).json({ message: error.message });
  }
  if (error instanceof TeamManagementError || error instanceof CollaboratorManagementError) {
    return response.status(400).json({ message: error.message });
  }
  if (error instanceof RuleManagementError) return response.status(400).json({ message: error.message });
  if (error instanceof RuleEngineExecutionError || error instanceof TaskManagementError) {
    return response.status(400).json({ message: error.message });
  }
  if (error instanceof ClientConflictError) return response.status(409).json({ message: error.message });
  if (error instanceof ClientManagementError) return response.status(400).json({ message: error.message });
  if (error instanceof z.ZodError) {
    return response.status(422).json({ message: "Dados inválidos", issues: error.issues });
  }
  logger.error({ err: error, requestId: request.id }, "Unhandled request error");
  return response.status(500).json({ message: "Erro interno do servidor" });
};