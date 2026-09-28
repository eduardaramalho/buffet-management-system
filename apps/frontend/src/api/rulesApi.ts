import { httpClient } from './httpClient'
import type { CreateRuleInput, MatchedRule, Rule, RuleFilters, UpdateRuleInput } from '../types/rule'

export const listRules = async (filters: RuleFilters = {}) => (await httpClient.get<Rule[]>('/api/v1/rules', { params: filters })).data
export const getRule = async (id: string) => (await httpClient.get<Rule>(`/api/v1/rules/${id}`)).data
export const createRule = async (input: CreateRuleInput) => (await httpClient.post<Rule>('/api/v1/rules', input)).data
export const updateRule = async (id: string, input: UpdateRuleInput) => (await httpClient.put<Rule>(`/api/v1/rules/${id}`, input)).data
export const removeRule = async (id: string) => { await httpClient.delete(`/api/v1/rules/${id}`) }
export const setRuleActive = async (id: string, active: boolean) => (await httpClient.patch<Rule>(`/api/v1/rules/${id}/${active ? 'activate' : 'deactivate'}`)).data

export const getEventRuleMatches = async (eventId: string) => (await httpClient.get<MatchedRule[]>(`/api/v1/events/${eventId}/rule-matches`)).data
