# ADR 0018: Gestor com acesso completo e admin como conta protegida

- **Status:** Aceito
- **Data:** 2026-11-09
- **Substitui:** a decisão 5 do ADR 0013 (gestor sem mudança de permissões)
- **Escopo:** Backend (`seedData.ts`, `UserService`, `UserPasswordService`, `PrismaUserRepository`, `UserManagementRepository`), frontend (`UserForm`, `UsersListPage`), E2E (passos 2, 19 e 20 da jornada)
- **Tarefa:** KAN-76 (item 7 da KAN-68)

## Contexto

A RFC (seções 3.1 e 4) descreve o gestor operando o sistema: acompanha o Dashboard do Gestor, faz ajustes manuais no planejamento, consulta relatórios e o histórico de execução. O papel `gestor` do seed tinha só `users:list`, `users:read`, `users:update`, `audit:read` e `clients:*` (decisão 5 do ADR 0013). Ele abria em Clientes e não via eventos, regras, tarefas, equipes, dashboard nem relatórios. Na prática, só o admin conseguia usar o sistema.

Em 02/11/2026 foi cogitado remover o papel admin e deixar só gestor e colaborador. Em 03/11/2026 a decisão foi manter os três papéis: o admin continua existindo como a conta do dono, protegida, e o gestor passa a ter o acesso operacional completo.

Ao dar ao gestor a gestão de usuários, apareceram três brechas que antes só o admin podia explorar:

- `POST /users` aceitava qualquer `roleId`, inclusive o do papel admin. Um gestor criaria um admin e passaria a ter a conta protegida.
- Nada impedia desativar ou excluir a própria conta, nem gerar uma senha temporária para si mesmo pela tela de usuários.
- Usuário inexistente respondia 403 (`UserManagementError`) na edição, ativação e exclusão, e 500 no `GET /users/:id` (`Error` genérico).

## Decisões

1. **Gestor = admin menos a gestão de papéis.** A matriz do seed deriva o gestor do admin, retirando `roles:create`, `roles:update`, `roles:delete` e `roles:manage-permissions` (`ROLE_MANAGEMENT_PERMISSIONS`). Ele mantém `roles:list` e `roles:read`, necessárias para escolher o papel no cadastro de usuário. Inclui dashboard, relatórios, eventos, serviços, regras, tarefas, equipes, colaboradores, clientes, auditoria e usuários (com `users:create`, `users:delete` e `users:reset-password`).
   - Derivar em vez de listar evita que uma permissão nova do admin fique de fora do gestor por esquecimento.
   - O seed roda a cada deploy (ADR 0011) e sincroniza a matriz (decisão 2 do ADR 0013): o gestor de produção recebe as permissões sem migration.
2. **Página inicial do gestor é o Dashboard.** Não houve código novo: `getHomePath` (ADR 0013) leva à primeira tela do menu que o papel abre, e agora o gestor tem `dashboard:view`.
3. **Admin é a conta protegida do dono.** Ninguém edita, desativa, exclui ou redefine a senha de um usuário com papel protegido pela interface (regra que já existia, por `isProtected`, não pelo nome do papel). Novo: o papel protegido **não é atribuído na criação de usuário** (403). O `UserService` consulta o papel por `findRoleById`; papel inexistente ou excluído responde 404. O formulário de cadastro não mostra papéis protegidos.
4. **A própria conta é travada na tela de usuários** (403):
   - Desativar ou excluir a si mesmo deixaria a pessoa sem acesso e sem como desfazer. Editar o próprio nome e e-mail continua permitido.
   - Redefinir a própria senha geraria uma senha temporária sem conferir a atual. A própria senha muda por `POST /auth/change-password`, que exige a senha atual (ADR 0012).
   - Na interface, os botões Desativar e Redefinir senha da própria linha ficam desabilitados com o motivo no `title`, e o interruptor "Usuário ativo" fica desabilitado na edição da própria conta.
5. **Usuário inexistente responde 404** (`NotFoundError`) em `GET`, `PUT`, `DELETE`, `PATCH .../activate|deactivate` e `POST .../reset-password`.

## Prós

- Fecha a lacuna com a RFC: o gestor usa o sistema que a RFC descreve, e o stakeholder pode ser cadastrado como gestor na validação.
- Mantém o menor privilégio onde importa: só o dono altera papéis e permissões, e ninguém vira admin pela tela.
- A mudança de acesso é só de dados (matriz do seed). As travas novas ficam no Service, então valem para a API inteira, não só para a tela.
- Continua sem comparação por nome de papel (ADR 0001): a proteção usa `isProtected`, e a autorização, permissões.

## Contras e limitações

- **Gestores se gerenciam entre si:** um gestor pode desativar, excluir ou redefinir a senha de outro gestor. Para PMEs, onde há um ou dois gestores, foi aceito; o admin continua como recuperação.
- **Gestor cria outros gestores:** com `users:create`, ele cadastra usuários com o próprio papel. Não ganha nada além do que já tem.
- O admin também não se desativa pela tela, mas isso já valia pela proteção da conta.
- O seed sobrescreve qualquer ajuste manual de permissões dos papéis do seed (limitação já registrada no ADR 0013).

## Alternativas descartadas

- **Remover o papel admin e deixar o gestor com tudo** (02/11/2026): o dono perderia a conta que ninguém consegue desativar ou ter a senha trocada, e a gestão de papéis ficaria com qualquer gestor.
- **Listar as permissões do gestor à mão:** mais explícito, mas uma permissão nova do admin precisaria ser lembrada em dois lugares.
- **Travar a própria conta só no frontend:** a API continuaria aceitando a chamada direta.
- **Recusar o papel admin pelo nome (`"admin"`):** contraria o ADR 0001; a regra usa `isProtected`.
