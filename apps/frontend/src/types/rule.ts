import type { EventType } from './event'
import type { TeamSpecialty } from './team'

export type RuleResourceRequirement = { id: string; specialty: TeamSpecialty; minQuantity: number }
export type RuleResourceRequirementInput = { specialty: TeamSpecialty; minQuantity: number }
// specialty: team specialty that receives the generated task automatically (RFC 3.1, ADR 0010).
export type RuleTaskTemplate = { id: string; ruleId: string; title: string; description: string | null; daysBeforeEvent: number | null; specialty?: TeamSpecialty | null }
export type RuleTaskTemplateInput = { title: string; description?: string | null; daysBeforeEvent?: number | null; specialty?: TeamSpecialty | null }

export type Rule = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  conditionServiceTypeIn: EventType[] | null
  conditionMinGuests: number | null
  conditionMaxGuests: number | null
  conditionRequiredServiceIds: string[] | null
  createdById: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  resourceRequirements: RuleResourceRequirement[]
  taskTemplates: RuleTaskTemplate[]
}

export type CreateRuleInput = {
  name: string
  description: string | null
  conditionServiceTypeIn: EventType[] | null
  conditionMinGuests: number | null
  conditionMaxGuests: number | null
  conditionRequiredServiceIds: string[] | null
  resourceRequirements: RuleResourceRequirementInput[]
  taskTemplates?: RuleTaskTemplateInput[]
}
export type UpdateRuleInput = Partial<CreateRuleInput> & { isActive?: boolean }
export type RuleFilters = { search?: string; isActive?: boolean }

// Preview-only result of the rules query engine for a given event — no side effects.
export type MatchedRule = { rule: Rule; resourceRequirements: RuleResourceRequirement[] }
