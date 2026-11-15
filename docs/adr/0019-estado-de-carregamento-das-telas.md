# ADR 0019: Estado de carregamento ao abrir as telas

- **Status:** Aceito
- **Escopo:** Frontend (`useInitialLoad`, `LoadBoundary`, telas de listagem, Dashboard, quadro de tarefas, Central do evento)
- **Origem:** KAN-79

## Contexto

As telas iniciavam o estado com valores vazios (`[]`, totais `0`) e só depois recebiam a resposta da API. Por um instante o usuário via "0 eventos", "Nenhum cliente encontrado." e o donut vazio, e em caso de erro os zeros continuavam na tela ao lado da mensagem. O pedido é que a tela abra já com os dados, com um loading apenas quando a resposta demorar.

## Decisão

1. **Hook `useInitialLoad`** (`src/hooks/useInitialLoad.ts`) controla a primeira carga de cada tela com o status `loading | ready | error`.
   - Só a primeira carga passa por `loading`. Recargas posteriores (troca de filtro via `key`, aba que volta a abrir via `enabled`) mantêm os dados na tela e uma falha vira `refreshError`, sem esconder o conteúdo.
   - Respostas atrasadas de uma `key` antiga são descartadas (o `onData` não é chamado).
   - Usa `getApiErrorMessage`, então a mensagem do backend aparece quando existir.
2. **Componente `LoadBoundary`** (`src/components/LoadBoundary.tsx`) só renderiza o conteúdo quando o status é `ready`. Em `loading` reserva a área e em `error` mostra a mensagem com **Tentar de novo**.
3. **Indicador com atraso de 300 ms** (`LOADING_INDICATOR_DELAY_MS`): se a API responder antes disso, a tela vai direto da área vazia para os dados, sem spinner piscando. O indicador usa `role="status"` e a área recebe `aria-busy`.
4. **Escopo:** o cabeçalho da tela (título e ações) aparece na hora; totais, filtros, tabela, paginação e mensagens de lista vazia ficam dentro do `LoadBoundary`. No Dashboard cada bloco tem a sua carga, então um bloco lento não segura os outros. Na listagem de eventos, Ativos e Excluídos têm cargas independentes.
5. **Polling** (ADR 0004) só começa depois que a primeira carga termina, no Dashboard e no quadro de tarefas.

## Prós

- Os dados zerados nunca aparecem antes da resposta, nem junto de um erro.
- Em respostas rápidas não há loading visível, que era o comportamento pedido.
- Uma regra só para todas as telas, testada uma vez no hook e no componente.

## Contras

- Na primeira visita a uma tela ainda existe a espera da rede: o atraso de 300 ms esconde o indicador, mas não a latência.
- Cada tela continua dona do próprio estado; não há compartilhamento de dados entre telas.

## Alternativas consideradas

- **Spinner imediato:** pisca em toda navegação rápida, o oposto do que foi pedido.
- **Skeleton (blocos cinza no formato da tela):** boa percepção de velocidade, mas exige um esqueleto por tela e manutenção junto do layout. Pode ser adotado depois dentro do próprio `LoadBoundary`.
- **Cache em memória (stale-while-revalidate, ex.: TanStack Query):** mostraria os dados na hora ao voltar para uma tela já visitada. Fica como evolução futura: traz dependência nova e exige invalidar o cache após cada criação, edição e exclusão.
