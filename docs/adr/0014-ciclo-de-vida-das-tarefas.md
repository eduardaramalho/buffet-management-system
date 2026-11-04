# ADR 0014: Ciclo de vida das tarefas

- **Status:** Aceito
- **Data:** 2026-11-03
- **Escopo:** Backend (`task.statusTransitions.ts`, `TaskService.updateStatus`), frontend (`types/task.ts`, `TasksBoardPage`), E2E (passo 13 da jornada)

## Contexto

O ADR 0003 deixou a transição de status das tarefas para o módulo de gestão operacional. Esse módulo só proibia que uma tarefa concluída ou cancelada voltasse para Pendente ou Em andamento. Na prática, isso deixava três brechas:

- **Uma tarefa concluída podia ser cancelada.** `CONCLUIDA → CANCELADA` era aceito e apagava o `completedAt`. Isso distorcia o indicador de tarefas concluídas no prazo e a definição de tarefa esquecida dos relatórios (ADR 0006), que sustentam a hipótese da RFC.
- **O status mudava em eventos encerrados.** Criar tarefas já era bloqueado em eventos concluídos ou cancelados, mas a mudança de status não era.
- **Mudar para o mesmo status era aceito.** A auditoria registrava uma mudança que não aconteceu.

O colaborador usa justamente essa rota (ADR 0013), então essas brechas apareceriam na validação com o stakeholder.

## Decisões

1. **Matriz de transições no domínio** (`task.statusTransitions.ts`), no mesmo formato da matriz de eventos (ADR 0001):

   ```mermaid
   stateDiagram-v2
       [*] --> PENDENTE
       PENDENTE --> EM_ANDAMENTO
       PENDENTE --> CANCELADA
       EM_ANDAMENTO --> PENDENTE
       EM_ANDAMENTO --> CONCLUIDA
       EM_ANDAMENTO --> CANCELADA
       CONCLUIDA --> [*]
       CANCELADA --> [*]
   ```

   - **A tarefa precisa ser iniciada antes de ser concluída.** Isso torna o andamento visível no quadro e no dashboard.
   - **Em andamento pode voltar para Pendente**, para quando alguém inicia a tarefa por engano. Como o `completedAt` só é preenchido na conclusão, isso não afeta nenhum indicador.
   - **Concluída e Cancelada são terminais**, sem nenhuma saída.
2. **Evento encerrado:** se o evento está Concluído ou Cancelado, as tarefas que ficaram abertas **só podem ser canceladas**. Assim elas deixam de contar como pendentes, sem permitir que alguém conclua uma tarefa depois do evento.
3. **Mesmo status** responde 400 e não grava auditoria.
4. **Erros:** `TaskManagementError` (400), com mensagens em português que citam os status, por exemplo: "Transição de status inválida: de Pendente para Concluída".
5. **Frontend:** o quadro de tarefas oferece apenas os próximos status válidos (`getTaskDestinations`), espelhando a matriz. O backend continua sendo o dono da regra.

## Consequências

- Os indicadores de pontualidade e de tarefas esquecidas passam a ser confiáveis: uma tarefa concluída nunca perde o `completedAt`.
- Mover uma tarefa direto de Pendente para Concluída agora exige dois passos.
- A matriz existe em dois lugares (backend e frontend). Uma mudança nela exige revisar os dois e este ADR.
- **Limitação:** editar e excluir tarefas abertas de um evento encerrado continuam permitidos. Este ADR trata só do status.
