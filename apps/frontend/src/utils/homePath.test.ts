import { describe, expect, it } from 'vitest'
import { NO_ACCESS_PATH, getHomePath } from './homePath'

const userWith = (permissions: string[]) => ({ roles: [{ name: 'papel', permissions }] })

describe('getHomePath', () => {
  it('opens the dashboard for whoever can see it', () => {
    expect(getHomePath(userWith(['dashboard:view', 'events:list', 'users:list']))).toBe('/')
  })

  it('follows the menu order: the colaborador lands on events', () => {
    expect(getHomePath(userWith(['users:read', 'events:list', 'events:read', 'tasks:list']))).toBe('/events')
  })

  it('sends the gestor to clients, the first menu entry it can open', () => {
    expect(getHomePath(userWith(['users:list', 'users:read', 'clients:list']))).toBe('/clients')
  })

  it('combines the permissions of every role', () => {
    expect(getHomePath({ roles: [{ permissions: ['users:read'] }, { permissions: ['tasks:list'] }] })).toBe('/tasks')
  })

  it('falls back to the no-access page when no screen is allowed', () => {
    expect(getHomePath(userWith(['users:read']))).toBe(NO_ACCESS_PATH)
    expect(getHomePath({ roles: undefined })).toBe(NO_ACCESS_PATH)
  })
})
