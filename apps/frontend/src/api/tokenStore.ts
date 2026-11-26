// Só o access token fica no frontend, e apenas em memória. O refresh token vive em cookie httpOnly,
// que o JavaScript da página não lê (ADR 0020).
let accessToken: string | null = null

export const getAccessToken = () => accessToken
export const setAccessToken = (token: string | null) => { accessToken = token }
export const clearAccessToken = () => { accessToken = null }
