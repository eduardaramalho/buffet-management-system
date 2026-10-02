import { EventTeamManagementError } from "../../teams/application/EventTeamService.js";
import type { EventTeamService } from "../../teams/application/EventTeamService.js";
import type { TeamRepository } from "../../teams/domain/team.types.js";
import type { EventRepository } from "../../events/domain/event.types.js";
import type { RuleEngineService } from "../../rules/application/RuleEngineService.js";
import type {
  ApplyRulesOptions,
  AuditService,
  ExecutionResult,
  RuleApplicationRepository,
  RuleTaskTemplateRepository,
  TaskRepository,
} from "../domain/task.types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class RuleEngineExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleEngineExecutionError";
  }
}

// The heart of Rule Engine Part 2: turns the pure matches produced by RuleEngineService.evaluate()
// (Part 1, not reimplemented here) into concrete Tasks and Team assignments for an Event.
export class RuleEngineExecutionService {
  constructor(
    private readonly ruleEngine: RuleEngineService,
    private readonly events: EventRepository,
    private readonly teams: TeamRepository,
    private readonly eventTeamService: EventTeamService,
    private readonly tasks: TaskRepository,
    private readonly ruleApplications: RuleApplicationRepository,
    private readonly ruleTaskTemplates: RuleTaskTemplateRepository,
    private readonly audit: AuditService,
  ) {}

  async applyRules(eventId: string, actorId: string, options: ApplyRulesOptions = {}): Promise<ExecutionResult> {
    const event = await this.events.findById(eventId);
    if (!event) throw new RuleEngineExecutionError("Evento não encontrado");

    // Forced reprocessing: drop the idempotency marker for this single rule so it runs again.
    if (options.forceRuleId) {
      await this.ruleApplications.remove(eventId, options.forceRuleId);
    }

    const contractedServiceIds = event.services.map((service) => service.serviceId);
    const matches = await this.ruleEngine.evaluate({ serviceType: event.serviceType, guestsCount: event.guestsCount }, contractedServiceIds);

    const result: ExecutionResult = { tasksCreated: 0, teamsAutoAssigned: 0, alertsGenerated: 0 };

    for (const match of matches) {
      // Idempotency guard (decision 2): a rule is only ever processed once per event.
      const alreadyApplied = await this.ruleApplications.findByEventAndRule(eventId, match.rule.id);
      if (alreadyApplied) continue;

      const assignedTeamIds = new Set((await this.eventTeamService.listTeamsByEvent(eventId)).map((assignment) => assignment.teamId));

      for (const requirement of match.resourceRequirements) {
        const specialtyTeams = await this.teams.list({ specialty: requirement.specialty });
        const alreadyAssignedCount = specialtyTeams.filter((team) => assignedTeamIds.has(team.id)).length;
        let remaining = requirement.minQuantity - alreadyAssignedCount;

        if (remaining > 0) {
          const candidates = specialtyTeams.filter((team) => team.status === "ATIVA" && !assignedTeamIds.has(team.id));
          for (const candidate of candidates) {
            if (remaining <= 0) break;
            try {
              await this.eventTeamService.assignTeamToEvent(eventId, candidate.id, actorId);
            } catch (error) {
              // Conflict or team became unavailable mid-loop: try the next candidate instead of failing.
              if (error instanceof EventTeamManagementError) continue;
              throw error;
            }
            assignedTeamIds.add(candidate.id);
            remaining -= 1;
            result.teamsAutoAssigned += 1;
            await this.audit.record({
              userId: actorId,
              action: "TEAM_AUTO_ASSIGNED",
              entity: "Event",
              entityId: eventId,
              changes: { teamId: candidate.id, ruleId: match.rule.id, specialty: requirement.specialty },
            });
          }
        }

        if (remaining > 0) {
          const alertTask = await this.tasks.create({
            eventId,
            title: `Faltam ${remaining} equipe(s) de ${requirement.specialty} para o evento`,
            description: null,
            dueDate: null,
            assignedTeamId: null,
            sourceRuleId: match.rule.id,
          });
          result.tasksCreated += 1;
          result.alertsGenerated += 1;
          await this.audit.record({
            userId: actorId,
            action: "TASK_GENERATED",
            entity: "Task",
            entityId: alertTask.id,
            changes: { eventId, ruleId: match.rule.id, kind: "TEAM_SHORTAGE_ALERT", specialty: requirement.specialty },
          });
        }
      }

      const templates = await this.ruleTaskTemplates.listByRuleId(match.rule.id);
      for (const template of templates) {
        const dueDate = template.daysBeforeEvent != null
          ? new Date(event.eventDate.getTime() - template.daysBeforeEvent * MS_PER_DAY)
          : null;
        const task = await this.tasks.create({
          eventId,
          title: template.title,
          description: template.description,
          dueDate,
          assignedTeamId: null,
          sourceRuleId: match.rule.id,
        });
        result.tasksCreated += 1;
        await this.audit.record({
          userId: actorId,
          action: "TASK_GENERATED",
          entity: "Task",
          entityId: task.id,
          changes: { eventId, ruleId: match.rule.id, templateId: template.id },
        });
      }

      await this.ruleApplications.create(eventId, match.rule.id);
    }

    return result;
  }
}
