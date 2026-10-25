import { EventTeamManagementError } from "../../teams/application/EventTeamService.js";
import type { EventTeamService } from "../../teams/application/EventTeamService.js";
import type { TeamRepository } from "../../teams/domain/team.types.js";
import type { EventRepository } from "../../events/domain/event.types.js";
import type { RuleEngineService } from "../../rules/application/RuleEngineService.js";
import type { TransactionClient, TransactionRunner } from "../../../shared/domain/transaction.types.js";
import type {
  ApplyRulesOptions,
  AuditService,
  ExecutionResult,
  RuleApplicationRepository,
  RuleTaskTemplateRepository,
  TaskRepository,
} from "../domain/task.types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const shortageAlertPattern = /^Faltam \d+ equipe\(s\) de (.+) para o evento$/;
const OPEN_TASK_STATUSES = new Set(["PENDENTE", "EM_ANDAMENTO"]);

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
    private readonly transactions: TransactionRunner,
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

    const result: ExecutionResult = { tasksCreated: 0, tasksSkipped: 0, teamsAutoAssigned: 0, alertsGenerated: 0 };

    for (const match of matches) {
      // Idempotency guard (decision 2): a rule is only ever processed once per event.
      const alreadyApplied = await this.ruleApplications.findByEventAndRule(eventId, match.rule.id);
      if (alreadyApplied) continue;

      // Atomicity: every write of a single rule application (team assignments, generated tasks and
      // the final idempotency marker) commits or rolls back together. Without this, a crash between
      // writes (e.g. after creating a Task but before the RuleApplication row) would leave the rule
      // looking "not yet applied" on the next run, duplicating tasks/assignments.
      await this.transactions.run(async (tx) => {
        const existingTasks = await this.tasks.listAllByEventId(eventId);
        // Allocation order is kept (listTeamsByEvent is ordered by assignedAt) as the tie-breaker of ADR 0010.
        const allocationOrder = (await this.eventTeamService.listTeamsByEvent(eventId)).map((assignment) => assignment.teamId);
        const assignedTeamIds = new Set(allocationOrder);
        const openTasksByTeam = countOpenTasksByTeam(existingTasks);

        for (const requirement of match.resourceRequirements) {
          const specialtyTeams = await this.teams.list({ specialty: requirement.specialty });
          const alreadyAssignedCount = specialtyTeams.filter((team) => assignedTeamIds.has(team.id)).length;
          let remaining = requirement.minQuantity - alreadyAssignedCount;

          if (remaining > 0) {
            const candidates = specialtyTeams.filter((team) => team.status === "ATIVA" && !assignedTeamIds.has(team.id));
            for (const candidate of candidates) {
              if (remaining <= 0) break;
              try {
                await this.eventTeamService.assignTeamToEvent(eventId, candidate.id, actorId, tx);
              } catch (error) {
                // Conflict or team became unavailable mid-loop: try the next candidate instead of failing.
                if (error instanceof EventTeamManagementError) continue;
                throw error;
              }
              assignedTeamIds.add(candidate.id);
              allocationOrder.push(candidate.id);
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
            const alertTitle = `Faltam ${remaining} equipe(s) de ${requirement.specialty} para o evento`;
            const alertExists = existingTasks.some((task) => {
              if (task.sourceRuleId !== match.rule.id) return false;
              const alertMatch = task.title.match(shortageAlertPattern);
              return alertMatch?.[1] === requirement.specialty;
            });
            if (alertExists) {
              result.tasksSkipped += 1;
            } else {
              const alertTask = await this.tasks.create({
                eventId,
                title: alertTitle,
                description: null,
                dueDate: null,
                assignedTeamId: null,
                sourceRuleId: match.rule.id,
              }, tx);
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
        }

        await this.generateTemplateTasks({ event, ruleId: match.rule.id, actorId, tx, existingTasks, allocationOrder, openTasksByTeam, result });

        await this.ruleApplications.create(eventId, match.rule.id, tx);
      });
    }

    return result;
  }

  // One task per template of the rule (skipping titles already generated: idempotency key), with the
  // deadline relative to the event and, when the template names a specialty, the responsible team (ADR 0010).
  private async generateTemplateTasks(context: {
    event: { id: string; eventDate: Date };
    ruleId: string;
    actorId: string;
    tx: TransactionClient;
    existingTasks: Array<{ sourceRuleId: string | null; title: string }>;
    allocationOrder: string[];
    openTasksByTeam: Map<string, number>;
    result: ExecutionResult;
  }) {
    const { event, ruleId, actorId, tx, existingTasks, allocationOrder, openTasksByTeam, result } = context;
    for (const template of await this.ruleTaskTemplates.listByRuleId(ruleId)) {
      if (existingTasks.some((task) => task.sourceRuleId === ruleId && task.title === template.title)) {
        result.tasksSkipped += 1;
        continue;
      }
      const dueDate = template.daysBeforeEvent == null ? null : new Date(event.eventDate.getTime() - template.daysBeforeEvent * MS_PER_DAY);
      const assignedTeamId = template.specialty ? await this.pickTeamForSpecialty(template.specialty, allocationOrder, openTasksByTeam) : null;
      const task = await this.tasks.create({
        eventId: event.id,
        title: template.title,
        description: template.description,
        dueDate,
        assignedTeamId,
        assignedAt: assignedTeamId ? new Date() : null,
        sourceRuleId: ruleId,
      }, tx);
      result.tasksCreated += 1;
      await this.audit.record({
        userId: actorId,
        action: "TASK_GENERATED",
        entity: "Task",
        entityId: task.id,
        changes: { eventId: event.id, ruleId, templateId: template.id, assignedTeamId },
      });
      if (assignedTeamId) await this.recordAutomaticAssignment(task.id, assignedTeamId, actorId, openTasksByTeam);
    }
  }

  private async recordAutomaticAssignment(taskId: string, teamId: string, actorId: string, openTasksByTeam: Map<string, number>) {
    openTasksByTeam.set(teamId, (openTasksByTeam.get(teamId) ?? 0) + 1);
    await this.audit.record({
      userId: actorId,
      action: "TASK_TEAM_ASSIGNED",
      entity: "Task",
      entityId: taskId,
      changes: { before: null, after: teamId, automatic: true },
    });
  }

  // ADR 0010: among the active teams of the specialty allocated to the event (RN17), the one with the
  // fewest open tasks in this event receives the task; a tie goes to the team allocated first.
  // Returns null when none is allocated (the shortage alert, RN15, already covers that case).
  private async pickTeamForSpecialty(specialty: string, allocationOrder: string[], openTasksByTeam: Map<string, number>) {
    const activeOfSpecialty = new Set(
      (await this.teams.list({ specialty: specialty as never }))
        .filter((team) => team.specialty === specialty && team.status === "ATIVA")
        .map((team) => team.id),
    );
    const candidates = allocationOrder.filter((teamId) => activeOfSpecialty.has(teamId));
    let chosen: string | null = null;
    for (const teamId of candidates) {
      if (chosen === null || (openTasksByTeam.get(teamId) ?? 0) < (openTasksByTeam.get(chosen) ?? 0)) chosen = teamId;
    }
    return chosen;
  }
}

function countOpenTasksByTeam(tasks: Array<{ assignedTeamId: string | null; status: string; deletedAt: Date | null }>) {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.assignedTeamId || task.deletedAt || !OPEN_TASK_STATUSES.has(task.status)) continue;
    counts.set(task.assignedTeamId, (counts.get(task.assignedTeamId) ?? 0) + 1);
  }
  return counts;
}
