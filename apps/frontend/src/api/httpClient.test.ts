import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { clearAccessToken, getAccessToken, httpClient, refreshSession, setAccessToken } from './httpClient'

const REFRESH_URL = '/api/v1/auth/refresh-token'
const session = { accessToken: 'new-access', user: { id: '1', name: 'Alice', email: 'alice@example.com', mustChangePassword: false } }
const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ data, status: 200, statusText: 'OK', headers: {}, config })
const unauthorized = (config: InternalAxiosRequestConfig) => Promise.reject({ config, response: { status: 401, data: {} } })

describe('httpClient', () => {
  afterEach(() => {
    clearAccessToken()
    httpClient.defaults.adapter = undefined
  })

  it('sends credentials so the browser attaches the httpOnly refresh token cookie', () => {
    expect(httpClient.defaults.withCredentials).toBe(true)
  })

  it('refreshes once after a 401 and retries the original request with the new access token', async () => {
    const authorizations: unknown[] = []
    let refreshBody: unknown = 'not-called'
    setAccessToken('expired')
    httpClient.defaults.adapter = (async (config) => {
      if (config.url === REFRESH_URL) {
        refreshBody = config.data
        return ok(config, session)
      }
      authorizations.push(config.headers.Authorization)
      return authorizations.length === 1 ? unauthorized(config) : ok(config, { ok: true })
    }) as AxiosAdapter

    await expect(httpClient.get('/api/v1/users')).resolves.toMatchObject({ data: { ok: true } })
    expect(authorizations).toEqual(['Bearer expired', 'Bearer new-access'])
    // O refresh token vai no cookie httpOnly (ADR 0020): nada dele no corpo da requisição.
    expect(refreshBody).toBeUndefined()
    expect(getAccessToken()).toBe('new-access')
  })

  it('does not retry the refresh endpoint after its own 401 and drops the access token', async () => {
    setAccessToken('expired')
    let refreshAttempts = 0
    httpClient.defaults.adapter = (async (config) => {
      if (config.url === REFRESH_URL) refreshAttempts += 1
      return unauthorized(config)
    }) as AxiosAdapter

    await expect(httpClient.get('/api/v1/users')).rejects.toMatchObject({ response: { status: 401 } })
    expect(refreshAttempts).toBe(1)
    expect(getAccessToken()).toBeNull()
  })

  it.each(['/api/v1/auth/login', '/api/v1/auth/logout'])('does not try to refresh after a 401 from %s', async (url) => {
    let refreshAttempts = 0
    httpClient.defaults.adapter = (async (config) => {
      if (config.url === REFRESH_URL) refreshAttempts += 1
      return unauthorized(config)
    }) as AxiosAdapter

    await expect(httpClient.post(url)).rejects.toMatchObject({ response: { status: 401 } })
    expect(refreshAttempts).toBe(0)
  })

  it('shares one refresh between requests that fail together, because the backend rotates the token', async () => {
    setAccessToken('expired')
    let refreshAttempts = 0
    httpClient.defaults.adapter = (async (config) => {
      if (config.url === REFRESH_URL) {
        refreshAttempts += 1
        return ok(config, session)
      }
      return config.headers.Authorization === 'Bearer new-access' ? ok(config, { url: config.url }) : unauthorized(config)
    }) as AxiosAdapter

    const results = await Promise.all([httpClient.get('/api/v1/users'), httpClient.get('/api/v1/events'), httpClient.get('/api/v1/tasks')])

    expect(results.map((result) => result.data.url)).toEqual(['/api/v1/users', '/api/v1/events', '/api/v1/tasks'])
    expect(refreshAttempts).toBe(1)
  })

  it('reuses the refresh in flight and starts a new one only after it settles', async () => {
    let refreshAttempts = 0
    httpClient.defaults.adapter = (async (config) => {
      refreshAttempts += 1
      return ok(config, session)
    }) as AxiosAdapter

    const [first, second] = await Promise.all([refreshSession(), refreshSession()])
    expect(first).toEqual(session)
    expect(second).toEqual(session)
    expect(refreshAttempts).toBe(1)

    await refreshSession()
    expect(refreshAttempts).toBe(2)
  })

  it('lets a new refresh run after a failed one', async () => {
    let refreshAttempts = 0
    httpClient.defaults.adapter = (async (config) => {
      refreshAttempts += 1
      return refreshAttempts === 1 ? Promise.reject({ config, response: { status: 400, data: {} } }) : ok(config, session)
    }) as AxiosAdapter

    await expect(refreshSession()).rejects.toMatchObject({ response: { status: 400 } })
    await expect(refreshSession()).resolves.toEqual(session)
  })
})
