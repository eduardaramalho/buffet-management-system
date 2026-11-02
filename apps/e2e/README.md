# Testes E2E (Playwright)

Jornada completa do sistema em um navegador real, contra um backend e um banco **dedicados**:

1. Login do administrador ("Esqueceu a senha?" orienta procurar o administrador)
2. Cadastro de usuário (gestor)
3. Cadastro de cliente
4. Catálogo de serviços (RF06): cadastro, nome duplicado (409), edição, exclusão lógica e "Outro" protegido na tela e na API (400)
5. Cadastro de equipe com colaborador
6. Cadastros de apoio: colaborador listado, equipe inativada pela tela e papéis do seed
7. Criação de regra com equipe responsável por tarefa; especialidade fora dos recursos recusada (400, ADR 0010)
8. Criação do evento e vínculo da equipe; serviço excluído não é oferecido
9. Fluxo alternativo: conflito de agenda (409), equipe inativa (400) e cancelamento de evento
10. Exclusão e restauração de evento; restaurar evento ativo (400) e registro no histórico
11. Confirmação do evento → motor de regras gera as tarefas e atribui a equipe (ADR 0010)
12. Tarefa manual e tarefas da regra já atribuídas
13. Execução: evento iniciado e tarefas concluídas
14. Conclusão do evento
15. Replicação do evento concluído (RF25), linhagem e equipe ocupada na nova data (409)
16. Dashboard gerencial
17. Relatórios (eventos, tarefas, desempenho das equipes) e exportação CSV/PDF
18. Redefinição de senha pelo administrador: admin protegido (403) e senha anterior invalidada (ADR 0012)
19. Troca obrigatória da senha temporária
20. Controle de acesso (RBAC) do gestor na interface e no backend
21. Sessão: botão Sair acessível em tela baixa e no celular

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
- O limite de login do backend é 5 tentativas a cada 15 min por IP; a jornada usa as 5 (a quinta
  confirma que a senha anterior deixa de valer após a redefinição). Um novo login na jornada estoura o limite. Como o backend
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
