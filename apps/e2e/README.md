# Testes E2E (Playwright)

Jornada completa do sistema em um navegador real, contra um backend e um banco **dedicados**:

1. Login do administrador
2. Cadastro de usuário (gestor)
3. Cadastro de cliente
4. Cadastro de equipe com colaborador
5. Criação de regra no motor de regras
6. Criação do evento e vínculo da equipe
7. Fluxo alternativo: conflito de agenda (409) e cancelamento de evento
8. Confirmação do evento → motor de regras gera as tarefas
9. Tarefa manual e atribuição de equipe às tarefas geradas
10. Execução: evento iniciado e tarefas concluídas
11. Conclusão do evento
12. Dashboard do gestor
13. Relatórios (eventos, tarefas, desempenho das equipes) e exportação CSV/PDF
14. Controle de acesso (RBAC) na interface e no backend

Os passos são dependentes (`test.describe.serial`). Erros de JavaScript não tratados na página
fazem qualquer passo falhar, mesmo que a API tenha respondido corretamente.

## Como funciona o ambiente

- O Playwright sobe o backend na porta `E2E_BACKEND_PORT` (padrão 3100) e o Vite na
  `E2E_FRONTEND_PORT` (padrão 5174). Nunca reaproveita servidores já abertos.
- Antes do backend subir, `scripts/start-backend.ts` executa `prisma migrate reset --force` e o seed
  no banco `E2E_DATABASE_URL`. **Esse banco é apagado a cada execução**; por segurança o nome
  precisa conter `e2e`.
- O token de acesso fica em memória no frontend, então a jornada navega pelo menu e não recarrega a
  página após o login.
- O limite de login do backend é 5 tentativas a cada 15 min por IP; a jornada usa 4. Como o backend
  é reiniciado a cada execução, o contador zera entre rodadas.

## Executar localmente

Pré-requisitos: MySQL rodando e dependências instaladas em `apps/backend` e `apps/frontend`.

```bash
cd apps/e2e
cp .env.e2e.example .env.e2e   # ajuste usuário/senha do MySQL
npm install
npm run install:browsers
npm test                       # headless
npm run test:headed            # vendo o navegador
npm run report                 # relatório HTML com trace das falhas
```

O usuário do MySQL precisa de permissão para criar e apagar o banco de testes.
