# Instruções do Projeto — Sistema de Gestão de Eventos para Buffets (TCC)

## Sobre o projeto
Sistema web para gestão de serviços e planejamento operacional de eventos de buffet, TCC de
Engenharia de Software. Desenvolvimento incremental por módulos, cada um com qualidade de produção.

## Stack
- **Backend**: Node.js, Express 5, TypeScript (ESM, `"type": "module"`), Prisma 7 (MySQL), bcryptjs,
  jsonwebtoken, Zod, Jest.
- **Frontend**: React 19, TypeScript, Vite, React Router, Axios, Vitest.

## Arquitetura obrigatória — não desviar
- Clean Architecture em camadas dentro de cada módulo:
  `domain/` (tipos/contratos) → `application/` (services, regra de negócio) →
  `infrastructure/` (repositories Prisma, providers, factories de DI manual) →
  `presentation/` (controllers, routes, middlewares).
- Repository Pattern + Service Layer + DTO Pattern.
- Injeção de dependência **manual via construtor**. Nunca usar container de DI ou decorators.
- RBAC baseado em **permissão**, nunca em nome de papel. Correto: `authorize("users:list")`.
  Errado: `if (user.role === 'admin')`.
- Módulo de referência para estilo e convenções: `apps/backend/src/modules/auth/`. Qualquer módulo
  novo deve seguir o mesmo padrão de nomenclatura e injeção de dependência usado lá.
- Erros de domínio lançados como classes de erro específicas (ex.: `AuthError`) e tratados
  centralizadamente no `errorHandler`. Nunca `try/catch` silencioso.

## Regras inegociáveis
- TDD estrito: teste primeiro (RED), implementação mínima (GREEN), depois refatora. Nunca escrever
  implementação sem o teste correspondente já existir e falhando.
- Cobertura mínima: 75% backend, 25% frontend.
- Proibido: código placeholder, `TODO` esquecido, mock deixado em produção, números mágicos sem
  constante nomeada, `console.log`/`console.error` (usar o logger estruturado do projeto).
- Toda decisão de arquitetura não trivial precisa de um comentário curto explicando o porquê.
- Não alterar `schema.prisma` sem explicar o motivo e o impacto em migrations existentes.
- Nunca introduzir uma dependência nova (lib, serviço externo, padrão arquitetural) sem justificar
  antes — perguntar em vez de assumir.

## Segurança (padrão esperado em todo módulo novo)
- Toda rota autenticada passa por `authenticate` + `authorize("<recurso>:<ação>")`.
- Nunca armazenar senha em texto puro; sempre via `PasswordHasher` (bcrypt).
- Tokens sensíveis (refresh, reset de senha) são armazenados com hash (nunca em texto puro no banco).
- Soft delete (`deletedAt`) em entidades com histórico relevante — nunca `DELETE` físico direto.
- Toda operação sensível (criar, editar, remover, ativar/desativar) registra auditoria via
  `AuditService`, chamado explicitamente no service (não via middleware automático).

## O que NÃO fazer
- Não gerar frontend como um único arquivo monolítico. Sempre separar em `api/`, `contexts/`,
  `pages/`, `components/`, `types/`.
- Não usar `localStorage` para dados sensíveis sem justificar a decisão em comentário.
- Não escrever testes de integração contra o MySQL real sem que isso seja pedido explicitamente
  (usar fakes/mocks nos testes unitários e de controller).
- Não assumir requisito não definido — sinalizar a ambiguidade em vez de decidir sozinho.
