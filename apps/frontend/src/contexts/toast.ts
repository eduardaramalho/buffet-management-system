import { createContext, useContext } from 'react'

/**
 * Avisos curtos. success: depois de salvar. error: ações sem formulário onde mostrar o erro,
 * como um movimento recusado no quadro de tarefas (KAN-77). Erros de formulário continuam junto dos campos.
 */
export type ToastApi = { success: (message: string) => void; error: (message: string) => void }

// Sem provider (testes de componente isolado), o aviso é ignorado em vez de quebrar a tela.
const noop: ToastApi = { success: () => undefined, error: () => undefined }
export const ToastContext = createContext<ToastApi>(noop)

export const useToast = () => useContext(ToastContext)
