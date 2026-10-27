import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const E2E_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const BACKEND_ROOT = path.resolve(E2E_ROOT, '../backend')
export const FRONTEND_ROOT = path.resolve(E2E_ROOT, '../frontend')

// Variáveis já definidas (ex.: no CI) têm prioridade sobre o arquivo local.
config({ path: path.join(E2E_ROOT, '.env.e2e'), quiet: true })

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} não configurada. Copie .env.e2e.example para .env.e2e e ajuste os valores.`)
  return value
}

const databaseUrl = required('E2E_DATABASE_URL')

// Trava de segurança: a suíte apaga o banco inteiro a cada execução.
const databaseName = new URL(databaseUrl).pathname.slice(1)
if (!databaseName.includes('e2e')) {
  throw new Error(`E2E_DATABASE_URL aponta para "${databaseName}". O nome do banco de testes precisa conter "e2e".`)
}

const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 3100)
const frontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 5174)

export const e2eEnv = {
  databaseUrl,
  backendPort,
  frontendPort,
  backendUrl: `http://localhost:${backendPort}`,
  frontendUrl: `http://localhost:${frontendPort}`,
  // Usuário criado pelo seed do backend (apps/backend/src/seed.ts); a senha é repassada como ADMIN_INITIAL_PASSWORD.
  admin: { email: 'admin@buffet.local', password: 'Admin123!' },
}
