// Sobe o backend para os testes E2E: recria o banco de testes do zero, aplica o seed e inicia a API.
// Executado pelo webServer do Playwright, então o banco é sempre resetado ANTES da API aceitar requisições.
import { execSync, spawn } from 'node:child_process'
import { BACKEND_ROOT, e2eEnv } from '../support/env.js'

const env = {
  ...process.env,
  DATABASE_URL: e2eEnv.databaseUrl,
  PORT: String(e2eEnv.backendPort),
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'e2e-only-access-secret',
  JWT_ACCESS_TTL: '15m',
  CORS_ORIGIN: e2eEnv.frontendUrl,
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
  NODE_ENV: 'test',
}

const run = (command: string) => execSync(command, { cwd: BACKEND_ROOT, env, stdio: 'inherit' })

run('npx prisma migrate reset --force')
run('npx prisma generate')
run('npx tsx prisma/seed.ts')

const server = spawn('npx', ['tsx', 'src/server.ts'], { cwd: BACKEND_ROOT, env, stdio: 'inherit', shell: true })
const stop = () => server.kill()
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
server.on('exit', (code) => process.exit(code ?? 0))
