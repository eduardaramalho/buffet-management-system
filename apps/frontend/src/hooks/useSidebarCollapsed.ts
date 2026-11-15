import { useCallback, useEffect, useState } from 'react'

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'eventospro:sidebar-collapsed'

// A preferência é só de conveniência visual: se o navegador bloquear o armazenamento,
// a barra continua funcionando e apenas não lembra a escolha.
const readPreference = (): boolean => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

const savePreference = (collapsed: boolean) => {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed))
  } catch {
    // Sem armazenamento disponível: mantém apenas o estado em memória.
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readPreference)

  useEffect(() => { savePreference(collapsed) }, [collapsed])

  const toggle = useCallback(() => { setCollapsed((current) => !current) }, [])

  return { collapsed, toggle }
}
