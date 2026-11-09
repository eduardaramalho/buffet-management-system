# ADR 0017: Quadro de tarefas com arraste, detalhe e comentários

- **Status:** Aceito
- **Data:** 2026-11-08
- **Escopo:** Frontend (`pages/TasksBoardPage.tsx`, `components/tasks/`, `components/ConfirmDialog.tsx`, `hooks/useModalDialog.ts`, `utils/taskBoard.ts`, `contexts/ToastContext.tsx`), Backend (módulo `tasks`: `TaskComment`, rotas de comentários, permissão `tasks:comment`), Banco (`task_comments`), E2E (jornada completa)
- **Tarefa:** KAN-77

## Contexto

O quadro de tarefas mudava o status por um `<select>` "Mover para..." em cada card. Funcionava, mas era lento para quem trabalha com muitas tarefas e não parecia um quadro. Não havia como ver a tarefa inteira, registrar observações ou conversar sobre ela.

Foram prototipadas três opções (colunas com detalhe em modal, raias por evento e foco no fluxo com histórico). A stakeholder aprovou a **Opção A: colunas com detalhe em modal**, com os filtros de equipe e de evento atrás de um botão de três pontos.

## Decisões

1. **Arrastar e soltar com `@dnd-kit/core`.**
   - Alternativas: HTML5 drag and drop nativo (sem dependência, mas não funciona em toque e é difícil de testar no jsdom) e `@hello-pangea/dnd` (pensado para listas ordenáveis, maior e com manutenção mais lenta). O dnd-kit tem sensores de mouse e toque, anúncios para leitor de tela e é pequeno.
   - O arraste começa só depois de 6 px (mouse) ou 200 ms pressionando (toque), para o clique no card continuar abrindo o detalhe.
   - A regra de transição continua no ADR 0014. `decideTaskDrop` só a aplica: movimento inválido é recusado com o motivo em português, o card treme e fica na coluna de origem. Cancelar pede confirmação, porque não dá para desfazer.
   - Durante o arraste, as colunas que aceitam o card ficam destacadas e as que recusam mostram o motivo.
2. **Atualização otimista.** O card muda de coluna na hora, com um indicador de "salvando". Se a API recusar, ele volta e o erro aparece num aviso. O quadro não é recarregado. Enquanto o movimento não termina, o polling (ADR 0004) não sobrescreve o status local daquela tarefa.
3. **Alternativa acessível ao arraste.** O detalhe da tarefa tem botões "Mover para" com só as transições válidas. Esse é o caminho para teclado e leitor de tela (WCAG 2.5.7). O `KeyboardSensor` do dnd-kit não foi usado: o card contém o botão do título, e Enter/Espaço iniciariam o arraste em vez de abrir o detalhe.
4. **Detalhe da tarefa em modal.** Clicar no card abre status, origem, evento, equipe, prazo, descrição e comentários. A descrição é editada ali mesmo (`PUT /tasks/:id`, `tasks:update`). Título, prazo e equipe continuam no formulário existente ("Editar tarefa"), que já valida a alocação da equipe ao evento.
5. **Comentários como entidade própria** (`TaskComment`, tabela `task_comments`).
   - `GET /api/v1/tasks/:id/comments` (`tasks:read`) e `POST /api/v1/tasks/:id/comments` (`tasks:comment`), texto de 1 a 2000 caracteres.
   - Permissão separada de `tasks:update` para o colaborador poder comentar sem editar a tarefa. Concedida ao admin e ao colaborador pelo seed.
   - Tarefas concluídas e canceladas aceitam comentário: o status fica congelado, as observações pós-evento não.
   - Cada comentário gera auditoria `TASK_COMMENTED`.
   - Por enquanto não há edição nem exclusão de comentário. A coluna `deleted_at` já existe para seguir o padrão de soft delete quando isso entrar.
6. **Componentes reaproveitados.** O comportamento de modal (Esc, Tab preso, foco devolvido) saiu do `FormModal` para o hook `useModalDialog`, usado também pelo detalhe e pelo `ConfirmDialog`. O `ToastProvider` ganhou `error`, usado nos movimentos recusados. O `ConfirmDialog` substitui o `window.confirm` do quadro.

## Consequências

- O card perdeu o seletor de status e os botões de editar e excluir. Essas ações ficam no detalhe.
- A jornada E2E move as tarefas pelo detalhe e registra um comentário.
- **Limitações:** o card não mostra quantos comentários a tarefa tem (exigiria mudar a listagem de tarefas). Comentários não podem ser editados nem excluídos. O papel gestor do seed continua sem permissões de tarefas, como na `main`.
