# ADR 0012: Recuperação de senha por redefinição administrativa

- **Status:** Aceito
- **Escopo:** Backend (`AuthService`, `UserPasswordService`, `CryptoTemporaryPasswordGenerator`, `JwtTokenProvider`, `authenticate`, `PrismaUserRepository`, `errorHandler`, seed, migration `20261028120000_admin_password_reset`), frontend (`LoginPage`, `ChangePasswordPage`, `ResetPasswordDialog`, `UsersListPage`, `ProtectedRoute`, `AuthContext`), E2E (passos 18 e 19 da jornada)

## Contexto

A tela de login oferecia "Esqueci minha senha", com `POST /auth/forgot-password` e `POST /auth/reset-password`, mas o e-mail nunca era enviado: o `ConsoleEmailProvider` só escrevia o token no log. Em produção isso era pior do que não ter a funcionalidade. O usuário não recebia nada, e quem tivesse acesso aos logs da VM conseguia redefinir a senha de qualquer conta. O fluxo também não encerrava as sessões abertas, não invalidava tokens anteriores e não registrava auditoria.

O sistema é interno. Os usuários são funcionários do buffet cadastrados pelo administrador, que já os conhece e fala com eles diretamente. O prazo de entrega é curto, e a VM da Azure bloqueia a porta 25 de saída, então o envio exigiria um provedor SMTP externo.

## Decisões

1. **A recuperação passa a ser feita pelo administrador.** O usuário que esqueceu a senha procura o administrador, que clica em "Redefinir senha" na lista de usuários. A tela de login deixa de ter o link e informa: "Esqueceu a senha? Procure o administrador do sistema."
2. **Senha temporária gerada pelo sistema.** `POST /api/v1/users/:id/reset-password` (permissão `users:reset-password`, só do papel admin) gera 12 caracteres com `crypto.randomInt`, sem caracteres ambíguos (`0 O 1 l I`) e com ao menos uma maiúscula, uma minúscula e um dígito. A resposta traz `{ temporaryPassword, expiresAt }`. A senha aparece uma única vez na tela, é gravada só como hash bcrypt e nunca vai para auditoria ou log.
3. **Validade de 24 horas.** `users.temp_password_expires_at` guarda o prazo. Depois dele, login, renovação de sessão e troca de senha com a temporária respondem 400 com o código `TEMP_PASSWORD_EXPIRED`, e só uma nova redefinição libera o acesso. A senha é conferida antes do prazo: quem errou a senha recebe o erro genérico de credenciais.
4. **Troca obrigatória no próximo login.** `users.must_change_password` fica `true` até o usuário trocar a senha em `POST /api/v1/auth/change-password`. A troca confere a senha atual, exige uma nova diferente (mínimo de 8 caracteres) e devolve um par novo de tokens.
5. **Bloqueio no backend, seguro por padrão.** O access token carrega a claim `mustChangePassword`. O middleware `authenticate` recusa com 403 e o código `PASSWORD_CHANGE_REQUIRED` qualquer rota enquanto a claim for `true`. Só `GET /auth/me` e `POST /auth/change-password` usam `authenticateAllowingPasswordChange`. Uma rota nova nasce bloqueada, sem lista de exceções por URL. O frontend redireciona para `/change-password`, mas não é ele que garante a regra.
6. **Senha e sessões mudam juntas.** Redefinir e trocar a senha gravam o hash e revogam todos os refresh tokens do usuário na mesma transação.
7. **Administradores protegidos não são alvo.** A mesma regra do `UserService`: a senha de um usuário com papel protegido não é redefinida pela interface (403). Usuário inativo responde 409 (precisa ser reativado antes), e usuário inexistente ou excluído, 404.
8. **Auditoria:** `USER_PASSWORD_RESET` (autor é o administrador, com o prazo de validade) e `USER_PASSWORD_CHANGED` (autor é o próprio usuário).
9. **Remoção do fluxo por e-mail:** endpoints, páginas, `ConsoleEmailProvider`, `PrismaPasswordResetTokenRepository`, variável `PASSWORD_RESET_TTL_MS` e a tabela `password_reset_tokens`, que guardava apenas tokens de uso único e curta duração.

## Por que a flag vai no token

| | Claim no access token (escolhida) | Consulta ao banco em cada requisição |
|---|---|---|
| Onde o bloqueio vive | No `authenticate`, separado da checagem de permissão | Dentro do `authorize`, misturado ao RBAC |
| Rotas sem `authorize` | Bloqueadas também | Ficariam abertas |
| Consistência | O par de tokens é reemitido na troca, e a renovação relê o banco | Sempre atual |
| Limitação | Se o administrador redefinir a senha de alguém já logado, o access token atual continua válido até expirar (15 min). Os refresh tokens já foram revogados, então a sessão termina nesse prazo | Nenhuma |

O `authorize` já consulta o banco a cada requisição, então economizar uma query não foi o motivo. O motivo foi manter o bloqueio em um ponto único, que vale inclusive para rotas sem permissão específica.

## Prós

- Nenhuma dependência externa nem risco de o e-mail cair no spam na apresentação.
- Fecha a falha do token gravado em log e a ausência de revogação de sessões.
- Auditoria completa de quem redefiniu e de quando o usuário trocou.

## Contras e limitações

- O usuário depende do administrador para recuperar o acesso, inclusive fora do horário comercial.
- O administrador vê a senha temporária. A troca obrigatória e o prazo de 24 horas limitam esse risco.
- O próprio administrador não tem recuperação pela interface. Se esquecer a senha, a recuperação é operacional (acesso ao banco ou novo seed com outra conta).

## Alternativas descartadas

- **Concluir o fluxo por e-mail (SMTP via Brevo ou Resend):** exigiria conta externa, verificação de remetente e segredos novos. Sem domínio próprio, as mensagens tendem a cair no spam.
- **Azure Communication Services Email:** mantém tudo na Azure, mas consome crédito do Azure for Students e exige configurar o domínio de envio, o que não cabe no prazo.
- **Os dois fluxos juntos:** mais código e testes, com a mesma dependência de SMTP.
