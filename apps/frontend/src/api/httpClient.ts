import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './tokenStore'

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

export const httpClient = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '' })

httpClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

httpClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined
  if (error.response?.status !== 401 || !config || config._retry || config.url === '/api/v1/auth/refresh-token' || !getRefreshToken()) return Promise.reject(error)

  config._retry = true
  try {
    const response = await httpClient.post('/api/v1/auth/refresh-token', { refreshToken: getRefreshToken() })
    setAccessToken(response.data.accessToken)
    setRefreshToken(response.data.refreshToken)
    return httpClient(config)
  } catch (refreshError) {
    clearTokens()
    return Promise.reject(refreshError)
  }
})

export { clearTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken }