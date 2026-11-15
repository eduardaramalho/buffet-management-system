import { useEffect } from 'react'

export const APP_NAME = 'EventosPro'

// Formato "Tela · EventosPro": o nome da tela vem primeiro para continuar legível em abas estreitas.
export const formatPageTitle = (title?: string): string => {
  const pageTitle = title?.trim()
  return pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME
}

/** Define o título da aba do navegador para a tela atual. */
export function usePageTitle(title?: string) {
  useEffect(() => { document.title = formatPageTitle(title) }, [title])
}
