import { expect, request, type APIRequestContext, type APIResponse } from '@playwright/test'
import { e2eEnv } from './env'

type Credentials = { email: string; password: string }

/**
 * Cliente HTTP da suíte, usado para preparar dados e verificar regras que a interface não expõe
 * (ex.: conflito de agenda e RBAC no backend). O que o usuário faz pela tela é testado pela tela.
 */
export class ApiClient {
  private constructor(private readonly context: APIRequestContext) {}

  static async login(credentials: Credentials) {
    const anonymous = await request.newContext({ baseURL: e2eEnv.backendUrl })
    const response = await anonymous.post('/api/v1/auth/login', { data: credentials })
    await expectStatus(response, 200)
    const { accessToken } = await response.json() as { accessToken: string }
    await anonymous.dispose()
    const context = await request.newContext({ baseURL: e2eEnv.backendUrl, extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` } })
    return new ApiClient(context)
  }

  get(path: string) { return this.context.get(`/api/v1${path}`) }
  post(path: string, data?: unknown) { return this.context.post(`/api/v1${path}`, { data }) }

  async json<T>(response: Promise<APIResponse>, status = 200): Promise<T> {
    const resolved = await response
    await expectStatus(resolved, status)
    return await resolved.json() as T
  }

  dispose() { return this.context.dispose() }
}

export async function expectStatus(response: APIResponse, status: number) {
  // Mostra o corpo na falha: sem isso, um 422 vira só "expected 201, received 422".
  expect(response.status(), `${response.url()} -> ${await response.text()}`).toBe(status)
}
