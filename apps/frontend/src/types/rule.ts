import type { EventType } from './event'
import type { TeamSpecialty } from './team'

export type RuleResourceRequirement = { id: string; specialty: TeamSpecialty; minQuantity: number }
export type RuleResourceRequirementInput = { specialty: TeamSpecialty; minQuantity: number }

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
}

export type CreateRuleInput = {
  name: string
  description: string | null
  conditionServiceTypeIn: EventType[] | null
  conditionMinGuests: number | null
  conditionMaxGuests: number | null
  conditionRequiredServiceIds: string[] | null
  resourceRequirements: RuleResourceRequirementInput[]
}
export type UpdateRuleInput = Partial<CreateRuleInput> & { isActive?: boolean }
export type RuleFilters = { search?: string; isActive?: boolean }

// Preview-only result of the rules query engine for a given event — no side effects.
export type MatchedRule = { rule: Rule; resourceRequirements: RuleResourceRequirement[] }
