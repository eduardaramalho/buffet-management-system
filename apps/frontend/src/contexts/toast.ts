import { createContext, useContext } from 'react'

/** Aviso de sucesso exibido depois de salvar. O erro fica dentro do próprio formulário, junto dos campos. */
export type ToastApi = { success: (message: string) => void }

// Sem provider (testes de componente isolado), o aviso é ignorado em vez de quebrar a tela.
const noop: ToastApi = { success: () => undefined }
export const ToastContext = createContext<ToastApi>(noop)

export const useToast = () => useContext(ToastContext)
