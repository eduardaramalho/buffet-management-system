import { httpClient } from './httpClient'
import type { Service } from '../types/event'

export const listServices = async () => (await httpClient.get<Service[]>('/api/v1/services')).data