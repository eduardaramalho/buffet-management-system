import { httpClient } from './httpClient'
import type { CreateTeamInput, EventTeamAssignment, Team, TeamFilters, UpdateTeamInput } from '../types/team'

export const listTeams = async (filters: TeamFilters = {}) => (await httpClient.get<Team[]>('/api/v1/teams', { params: filters })).data
export const getTeam = async (id: string) => (await httpClient.get<Team>(`/api/v1/teams/${id}`)).data
export const createTeam = async (input: CreateTeamInput) => (await httpClient.post<Team>('/api/v1/teams', input)).data
export const updateTeam = async (id: string, input: UpdateTeamInput) => (await httpClient.put<Team>(`/api/v1/teams/${id}`, input)).data
export const setTeamActive = async (id: string, active: boolean) => (await httpClient.patch<Team>(`/api/v1/teams/${id}/${active ? 'activate' : 'deactivate'}`)).data
export const addTeamMember = async (teamId: string, collaboratorId: string, isLeader = false) => (await httpClient.post<Team>(`/api/v1/teams/${teamId}/members`, { collaboratorId, isLeader })).data
export const removeTeamMember = async (teamId: string, collaboratorId: string) => { await httpClient.delete(`/api/v1/teams/${teamId}/members/${collaboratorId}`) }

export const listTeamsByEvent = async (eventId: string) => (await httpClient.get<EventTeamAssignment[]>(`/api/v1/teams/events/${eventId}`)).data
export const listEventsByTeam = async (teamId: string) => (await httpClient.get<EventTeamAssignment[]>(`/api/v1/teams/${teamId}/events`)).data
export const assignTeamToEvent = async (teamId: string, eventId: string) => (await httpClient.post(`/api/v1/teams/${teamId}/events/${eventId}`)).data
export const unassignTeamFromEvent = async (teamId: string, eventId: string) => { await httpClient.delete(`/api/v1/teams/${teamId}/events/${eventId}`) }
