# ADR 0004: Atualização automática das telas operacionais via polling

- **Status:** Aceito
- **Escopo:** Frontend (`usePolling`, `TasksBoardPage`, `DashboardPage`, `EventDetailsPage`)

## Contexto

As telas operacionais (quadro de tarefas, dashboard e Central do evento) precisam refletir mudanças feitas por outros usuários sem recarregar a página. O backend não deve ser alterado.

## Decisão

Polling no cliente, via hook reutilizável `src/hooks/usePolling.ts`:

- Intervalo padrão de 30 s, configurável por `VITE_POLLING_INTERVAL_MS`.
- Pausa com a aba oculta (`document.visibilityState`); ao voltar, atualiza imediatamente e retoma o ciclo.
- Não sobrepõe chamadas em andamento e cancela o timer ao desmontar.
- Erro de uma rodada é ignorado: a tela mantém os dados anteriores.
- A atualização é silenciosa (sem spinner), preservando foco, filtros e formulários abertos. O indicador "Atualizado há X s" e o botão "Atualizar agora" ficam no cabeçalho.
- No dashboard, cada bloco é atualizado de forma independente.

## Prós

- Simples e fácil de testar (fake timers).
- Funciona com a autenticação atual (Bearer via Axios), sem infraestrutura nova.

## Contras

- Atraso de até 30 s na visualização das mudanças.
- Requisições repetidas, mesmo sem alterações.

## Alternativas descartadas por ora

- **SSE:** `EventSource` nativo não envia cabeçalho `Authorization`, exigindo outra forma de autenticação ou polyfill, além de cuidados com buffering de proxy e timeouts.
- **WebSocket:** exige gerenciar estado de conexão, reconexão e escala (sessões persistentes, balanceamento).

## Evolução futura

Migrar para **SSE** quando houver necessidade de menor latência, resolvendo antes a autenticação do canal e a configuração de proxy. O `usePolling` pode ser substituído mantendo a interface das telas.
