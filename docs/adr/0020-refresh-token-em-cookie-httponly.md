# ADR 0020: Refresh token em cookie httpOnly e sessão mantida ao recarregar a página

- **Status:** Aceito
- **Escopo:** Backend (`AuthController`, `RefreshTokenCookie`, `app.ts`, `env.ts`) e frontend (`httpClient`, `tokenStore`, `AuthContext`, `AppRoutes`)
- **Origem:** KAN-87
- **Relacionado:** ADR 0011 (hospedagem na mesma origem), ADR 0012 (revogação de sessões na troca de senha), ADR 0019 (indicador de carregamento)

## Contexto

O access token e o refresh token ficavam só em memória no frontend (`tokenStore`). A escolha mantinha os tokens fora do `localStorage`, onde um XSS os leria, mas tinha um custo de uso: qualquer F5 ou nova aba deslogava a pessoa. O pedido é continuar logado ao recarregar a página sem expor o refresh token ao JavaScript.

## Decisão

1. **O refresh token sai do corpo das respostas e passa a ir em cookie.** Login, `POST /auth/refresh-token` e `POST /auth/change-password` gravam o cookie `eventospro_rt` e devolvem só `{ accessToken, user }`. A geração, o hash SHA-256, a rotação e a revogação no banco não mudam.
2. **Atributos do cookie** (`RefreshTokenCookie`):
   - `HttpOnly`: o JavaScript da página não lê o cookie.
   - `SameSite=Strict`: outro site não consegue fazer o navegador enviar o cookie, o que protege o refresh e o logout contra CSRF.
   - `Path=/api/v1/auth`: o cookie só acompanha as rotas de autenticação, e não as demais chamadas da API.
   - `Max-Age` igual a `JWT_REFRESH_TTL_MS` (7 dias).
   - `Secure` controlado por `COOKIE_SECURE`. Sem valor, vale `true` em `NODE_ENV=production`. Em produção o Caddy serve HTTPS e o Compose define `COOKIE_SECURE=true`. O Compose local e o E2E usam `false`, porque rodam em HTTP e navegadores fora do Chromium descartam cookies `Secure` em `http://localhost`.
3. **Leitura e limpeza do cookie.** O `cookie-parser` lê os cookies. O refresh sem cookie responde como um refresh token inválido (`AuthError`). Quando o refresh falha por autenticação (cookie ausente, token revogado ou expirado), o backend apaga o cookie. O logout revoga o token do cookie, quando houver, e sempre apaga o cookie (204). Um `refreshToken` enviado no corpo, como no contrato antigo, é ignorado.
4. **CORS com credenciais.** `credentials: true`, mantendo a lista explícita de `CORS_ORIGIN` e o bloqueio 403 para outras origens. Em produção a API está na mesma origem (ADR 0011). O ajuste é necessário para o Compose local, onde o frontend (porta 8080) e a API (porta 3000) são origens diferentes do mesmo site.
5. **Access token continua só em memória.** O Axios usa `withCredentials: true` para o navegador enviar o cookie.
6. **Restauração da sessão no carregamento.** Ao montar, o `AuthProvider` chama o refresh e depois `GET /auth/me`. Enquanto isso, `restoring` fica verdadeiro e o `AppRoutes` mostra o indicador de carregamento do ADR 0019 ("Carregando sessão..."), em vez de decidir a rota. Sem isso, um F5 em `/events` mandaria para o login antes da resposta.
7. **Um único refresh em andamento.** Como o backend gira o token a cada renovação, dois refresh em paralelo derrubariam a sessão: o segundo chegaria com um token já revogado. `refreshSession` (em `httpClient`) compartilha a mesma promise entre o carregamento da página (que o StrictMode executa duas vezes em desenvolvimento) e vários 401 simultâneos. O interceptor não tenta renovar após um 401 de login, refresh ou logout.

## Prós

- F5, nova aba e reabertura do navegador mantêm a sessão por até 7 dias, sem o refresh token ficar acessível a scripts.
- Logout e redefinição de senha pelo admin continuam encerrando a sessão também depois de um F5: o token revogado no banco não renova mais, e o cookie é apagado.
- O access token, que autoriza as chamadas, segue fora de qualquer armazenamento persistente.

## Contras

- O contrato de autenticação mudou: clientes que liam `refreshToken` no corpo precisam usar o cookie.
- Cada carregamento da página faz um refresh e um `/me`, o que soma uma pequena espera e um registro novo em `refresh_tokens` por F5.
- Um XSS ainda poderia chamar a API com o access token em memória enquanto a página estiver aberta. O cookie protege o refresh token, não a sessão já aberta.
- Se a chamada de logout falhar por rede, o cookie e o token continuam válidos e um F5 restaura a sessão.

## Alternativas consideradas

- **Refresh token em `localStorage` ou `sessionStorage`:** simples, mas qualquer XSS leria o token e renovaria a sessão de fora do navegador. Contradiz a decisão de segurança documentada.
- **Access token também em cookie:** dispensaria o refresh no carregamento, mas tornaria todas as rotas da API sensíveis a CSRF e exigiria token anti-CSRF em cada requisição.
- **Token anti-CSRF (double submit) além do SameSite:** mais uma peça para manter, sem ganho real aqui: o cookie é `SameSite=Strict`, restrito às rotas de auth, e origens fora de `CORS_ORIGIN` recebem 403.
- **Parser de cookie próprio:** evitaria a dependência, mas seria código a mais para testar e manter. O `cookie-parser` é pequeno e é o padrão do Express.
