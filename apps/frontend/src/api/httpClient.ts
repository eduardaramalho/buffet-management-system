import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearAccessToken, getAccessToken, setAccessToken } from './tokenStore'
import type { Session } from '../types'

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

const REFRESH_URL = '/api/v1/auth/refresh-token'
// Um 401 nestas rotas não se resolve renovando a sessão: tentar só criaria um laço.
const NO_REFRESH_URLS = new Set([REFRESH_URL, '/api/v1/auth/login', '/api/v1/auth/logout'])

// withCredentials: o navegador envia o cookie httpOnly do refresh token também quando a API está em outra
// porta (docker compose local). Em produção a API está na mesma origem e o cookie iria de qualquer forma.
export const httpClient = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '', withCredentials: true })

let refreshInFlight: Promise<Session> | null = null

/**
 * Renova a sessão com o cookie do refresh token. Chamadas simultâneas compartilham a mesma requisição:
 * o backend gira o token a cada renovação, então um segundo refresh em paralelo chegaria com um token
 * já revogado e derrubaria a sessão (StrictMode no carregamento, vários 401 ao mesmo tempo).
 */
export const refreshSession = () => {
  refreshInFlight ??= httpClient.post<Session>(REFRESH_URL)
    .then((response) => {
      setAccessToken(response.data.accessToken)
      return response.data
    })
    .finally(() => { refreshInFlight = null })
  return refreshInFlight
}

httpClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

httpClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined
  if (error.response?.status !== 401 || !config || config._retry || NO_REFRESH_URLS.has(config.url ?? '')) throw error

  config._retry = true
  try {
    await refreshSession()
    return await httpClient(config)
  } catch (refreshError) {
    clearAccessToken()
    throw refreshError
  }
})

export { clearAccessToken, getAccessToken, setAccessToken }
