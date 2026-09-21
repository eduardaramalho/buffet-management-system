import { afterEach, describe, expect, it } from 'vitest'
import { clearTokens, httpClient, setAccessToken, setRefreshToken } from './httpClient'

describe('httpClient', () => {
  afterEach(() => {
    clearTokens()
    httpClient.defaults.adapter = undefined
  })

  it('refreshes once after a 401 and retries the original request', async () => {
    let originalAttempts = 0
    setAccessToken('expired')
    setRefreshToken('refresh-token')
    httpClient.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/refresh-token') {
        return { data: { accessToken: 'new-access', refreshToken: 'new-refresh', user: { id: '1', name: 'Alice', email: 'alice@example.com' } }, status: 200, statusText: 'OK', headers: {}, config }
      }
      originalAttempts += 1
      if (originalAttempts === 1) {
        return Promise.reject({ config, response: { status: 401, data: {} } })
      }
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config }
    }

    await expect(httpClient.get('/api/v1/users')).resolves.toMatchObject({ data: { ok: true } })
    expect(originalAttempts).toBe(2)
  })

  it('does not retry the refresh endpoint after its own 401', async () => {
    setAccessToken('expired')
    setRefreshToken('refresh-token')
    let refreshAttempts = 0
    httpClient.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/refresh-token') refreshAttempts += 1
      return Promise.reject({ config, response: { status: 401, data: {} } })
    }

    await expect(httpClient.get('/api/v1/users')).rejects.toMatchObject({ response: { status: 401 } })
    expect(refreshAttempts).toBe(1)
  })
})