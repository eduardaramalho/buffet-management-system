import type { EventType } from "../../events/domain/event.types.js";
import type { TeamSpecialty } from "../../teams/domain/team.types.js";

export type RuleResourceRequirementRecord = {
  id: string;
  specialty: TeamSpecialty;
  minQuantity: number;
};

export type RuleRecord = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  conditionServiceTypeIn: EventType[] | null;
  conditionMinGuests: number | null;
  conditionMaxGuests: number | null;
  conditionRequiredServiceIds: string[] | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  resourceRequirements: RuleResourceRequirementRecord[];
};

export type RuleResourceRequirementInput = {
  specialty: TeamSpecialty;
  minQuantity: number;
};

export type CreateRuleInput = {
  name: string;
  description: string | null;
  conditionServiceTypeIn: EventType[] | null;
  conditionMinGuests: number | null;
  conditionMaxGuests: number | null;
  conditionRequiredServiceIds: string[] | null;
  createdById: string;
  resourceRequirements: RuleResourceRequirementInput[];
};

export type UpdateRuleInput = Partial<Omit<CreateRuleInput, "createdById">> & {
  isActive?: boolean;
};

export type RuleListFilter = {
  search?: string;
  isActive?: boolean;
};

export interface RuleRepository {
  create(input: CreateRuleInput): Promise<RuleRecord>;
  findById(id: string): Promise<RuleRecord | null>;
  list(filter: RuleListFilter): Promise<RuleRecord[]>;
  listActive(): Promise<RuleRecord[]>;
  update(id: string, input: UpdateRuleInput): Promise<RuleRecord>;
  softDelete(id: string): Promise<RuleRecord>;
}

// Minimal event snapshot needed to evaluate conditions, decoupled from the Events module's full record shape.
export type RuleEvaluationEvent = {
  serviceType: EventType;
  guestsCount: number;
};

export type RuleEvaluationEventInput = RuleEvaluationEvent & {
  contractedServiceIds: string[];
};

export type MatchedRule = {
  rule: RuleRecord;
  resourceRequirements: RuleResourceRequirementRecord[];
};

export interface AuditService {
  record(input: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    changes?: Record<string, unknown>;
    reason?: string;
  }): Promise<void>;
}
