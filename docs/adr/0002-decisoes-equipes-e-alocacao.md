# ADR 0002: Pessoas de equipe e alocação em eventos

- **Status:** Aceito
- **Data:** 2026-09-07
- **Escopo:** Módulo Equipes

## Contexto

O módulo de equipes precisa representar grupos reutilizáveis, seus membros e a alocação desses grupos em eventos. Duas decisões afetam diretamente as relações do banco e seriam custosas de alterar depois: a entidade usada para membros e a possibilidade de reutilização de uma equipe em mais de um evento no mesmo período.

## Decisões

### Membros são `Collaborator`, não `User`

Os membros operacionais são modelados pela entidade `Collaborator`, relacionada a `Team` por `TeamMember`. `Collaborator` possui nome, telefone, função/cargo e status, mas não possui senha nem acesso ao sistema.

`User` continua representando exclusivamente pessoas que acessam a aplicação. Essa separação evita criar credenciais para colaboradores que não precisam de login, reduz a superfície do RBAC e permite que uma pessoa operacional pertença a várias equipes sem duplicar cadastro. Um eventual vínculo entre `Collaborator` e `User` fica fora do escopo atual.

`TeamMember.isLeader` identifica o responsável operacional da equipe. O domínio permite no máximo um líder por equipe.

### Equipes podem ser reutilizadas, mas não em eventos simultâneos

Uma mesma `Team` pode ser vinculada a vários `Event` por meio de `EventTeam`, preservando `assignedAt` e `assignedById` para rastreabilidade. A reutilização é permitida quando os intervalos dos eventos não se sobrepõem.

O `EventTeamService` bloqueia a atribuição quando existe outro evento da mesma equipe em conflito e retorna erro de negócio com status HTTP `409`. Para eventos sem `endDate`, o intervalo considerado é o dia inteiro da data do evento. Eventos `CONCLUIDO` e `CANCELADO` não aceitam novas atribuições; eventos em `PLANEJAMENTO` aceitam reservas antecipadas.

Essa regra fica na camada de aplicação, porque depende da combinação entre datas, status e vínculos existentes, e não pode ser expressa apenas pela chave composta de `EventTeam`.

## Consequências

- O schema usa `Collaborator`, `TeamMember` e `EventTeam` em vez de reutilizar `User` para trabalhadores operacionais.
- Colaboradores podem ser compartilhados entre equipes sem cadastro duplicado.
- A tabela `EventTeam` preserva o histórico de alocações.
- A validação de conflito exige consulta aos eventos já vinculados antes da criação de um novo vínculo.
- Alterações nas regras de agenda exigem revisão deste ADR, do `EventTeamService` e dos testes de conflito.