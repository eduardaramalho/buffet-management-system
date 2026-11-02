# ADR 0013: Perfil colaborador e página inicial por permissão

- **Status:** Aceito
- **Escopo:** Backend (`seedData.ts`, `DatabaseSeeder`, `PrismaSeedRepository`), frontend (`utils/homePath`, `ProtectedRoute`, `AppRoutes`, `EventsListPage`, `TasksBoardPage`, `UsersListPage`), E2E (passos 19, 20 e 22 da jornada)

## Contexto

A RFC (seção 3.1) diz que gestores e colaboradores acompanham a execução das atividades, atualizam o status e consultam as informações do evento. O papel `colaborador` existia no seed, mas com `users:read` e `users:update` e nenhuma permissão de evento ou tarefa:

- Não via o que precisava: nenhuma tela de evento ou tarefa.
- Podia o que não devia: com `users:update`, renomear ou desativar outros usuários (inclusive o gestor).
- Não conseguia usar o sistema: o `ProtectedRoute` mandava qualquer acesso negado para `/users`, que ele também não podia abrir, e a navegação entrava em loop.

Além disso, o seed só adicionava permissões. Uma permissão retirada da matriz continuava vinculada ao papel nos bancos já existentes, como o de produção.

## Decisões

1. **Colaborador é um perfil operacional somente de consulta, com uma única escrita:** `events:list`, `events:read`, `tasks:list`, `tasks:read`, `tasks:update-status` e `users:read` (exigida por `GET /auth/me`, que carrega a sessão). Ele acompanha os eventos, abre a Central do evento e move o status das tarefas. Não cria, edita nem exclui nada.
2. **A matriz do seed é a fonte da verdade.** O seed, que roda a cada deploy (ADR 0011), remove do papel as permissões que saíram da matriz (`revokeRolePermissionsExcept`). Não há tela de gestão de permissões, então nenhuma configuração manual é perdida.
3. **Página inicial por permissão:** depois do login, ou ao abrir uma tela não permitida, o usuário vai para a primeira tela do menu que o papel pode abrir (`getHomePath`, na mesma ordem do menu). Sem nenhuma tela permitida, uma página "Sem acesso" mantém o botão Sair. Com isso, o gestor passa a abrir em Clientes e o colaborador em Eventos.
4. **Botões só com a permissão correspondente:** Novo, Editar e Excluir na lista de eventos (`events:create`, `events:update`, `events:delete`) e Novo usuário (`users:create`). O quadro de tarefas só consulta equipes com `teams:list`; sem ela, não mostra o filtro de equipe.
5. **Gestor sem mudança de permissões** (decisão de 24/10/2026): `users:list`, `users:read`, `users:update`, `audit:read` e `clients:*`.

## Prós

- Fecha a promessa da RFC de os colaboradores atualizarem o status, com o menor privilégio possível.
- A mudança é só de dados (matriz) e de interface. O RBAC por permissão (ADR 0001) não precisou de código novo no backend.
- Remove a escalada em que um colaborador desativava outros usuários e o loop de navegação.

## Contras e limitações

- **Sem recorte por equipe:** o colaborador vê as tarefas de todos os eventos, não só as da sua equipe, porque `User` e `Collaborator` são entidades separadas (ADR 0002). O recorte exige vincular as duas, o que fica como trabalho futuro.
- Sem `teams:list`, os cartões do quadro não mostram o nome da equipe para o colaborador.
- O seed sobrescreve qualquer vínculo de permissão feito direto na API para os papéis do seed.

## Alternativas descartadas

- **Remover o papel colaborador:** mais simples, mas contradiz a RFC, e o gestor viraria o único a atualizar status.
- **Vincular `User` a `Collaborator` e filtrar as tarefas pela equipe:** é o modelo certo, mas exige migration, regras e telas novas, fora do prazo de entrega.
- **Liberar `teams:list` para o colaborador:** a tela de Equipes ficaria acessível com ações de criação e edição sem checagem de permissão na interface.
