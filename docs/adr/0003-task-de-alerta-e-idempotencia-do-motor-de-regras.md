# ADR 0003: Task de alerta, idempotência e escopo de status no motor de regras (Parte 2)

- **Status:** Aceito
- **Data:** 2026-10-02
- **Escopo:** Módulo Tarefas (`tasks`) / Motor de regras Parte 2 (`RuleEngineExecutionService`)

## Contexto

A Parte 1 do motor de regras (`RuleEngineService.evaluate()`, módulo `rules`) apenas identifica quais `Rule` casam com um evento. A Parte 2 (`RuleEngineExecutionService.applyRules()`, módulo `tasks`) precisa transformar esse resultado em efeitos concretos: criar `Task` e atribuir `Team` automaticamente. Três decisões dessa etapa têm impacto direto no comportamento observável pelo usuário e no schema, e por isso ficam registradas aqui.

## Decisões

### 1. Falta de equipe disponível gera Task de alerta, não erro

Quando uma `RuleResourceRequirement` exige mais equipes de uma especialidade do que há disponíveis (sem conflito de agenda, com status `ATIVA`), `RuleEngineExecutionService` **não lança exceção**. Em vez disso, cria uma `Task` com `assignedTeamId = null` descrevendo a equipe que falta, e segue processando o restante da regra.

Rejeitamos lançar erro porque `applyRules()` é disparado automaticamente na transição de um evento para `CONFIRMADO` (via `EventManagementService`). Se a ausência de equipe bloqueasse esse fluxo com uma exceção, a simples falta de recurso operacional impediria a confirmação do evento — um efeito colateral desproporcional para uma condição que é comum (disponibilidade de equipes muda com frequência) e que não impede o evento de existir, apenas exige atenção humana. A `Task` de alerta transforma "falta recurso" em um item de trabalho rastreável (visível em `GET /api/v1/tasks`) em vez de uma falha de sistema.

Essa Task usa `assignedTeamId = null` propositalmente: ela não representa uma atribuição pendente de uma equipe específica, e sim um aviso de que nenhuma equipe da especialidade exigida pôde ser alocada no momento do processamento.

### 2. Idempotência via `RuleApplication` (unique `eventId` + `ruleId`)

Cada aplicação bem-sucedida de uma regra a um evento é registrada em `RuleApplication`, com constraint de unicidade em `(eventId, ruleId)`. Antes de processar uma regra casada, `RuleEngineExecutionService` verifica se já existe esse registro; se existir, pula a regra inteira (nenhuma `Task` nova, nenhuma tentativa de atribuição).

Esse mecanismo é necessário porque `applyRules()` pode ser invocado mais de uma vez para o mesmo evento: automaticamente na transição para `CONFIRMADO` e manualmente via `POST /api/v1/events/:eventId/apply-rules` (ex.: um operador reexecutando o endpoint, ou uma regra que já tinha casado permanecendo ativa). Sem o controle de idempotência, cada nova chamada reavaliaria as mesmas regras e duplicaria `Task` e tentativas de `EventTeamService.assignTeamToEvent` — na prática, gerando tarefas repetidas e, no limite, erros de conflito de agenda ao tentar atribuir uma equipe já vinculada.

A granularidade escolhida é por regra, não pelo evento inteiro: permite que uma regra nova (criada ou ativada depois da primeira aplicação) seja processada em uma chamada futura sem reprocessar regras que já geraram seus efeitos. O reprocessamento forçado (`forceRuleId`) existe exatamente para contornar esse mecanismo quando necessário — ele remove o registro de `RuleApplication` daquela regra especificamente antes de reavaliar, deixando as demais regras já aplicadas intocadas.

### 3. Reprocessamento completa tarefas ausentes

Com `forceRuleId`, o motor remove o marcador da regra e reavalia seus efeitos, mas não reescreve tarefas existentes. Templates são comparados pela chave `(eventId, sourceRuleId, title)` e alertas de falta de equipe por `(eventId, sourceRuleId, especialidade)`. A busca inclui tarefas em qualquer status, inclusive canceladas, concluídas e com soft delete; por isso uma tarefa cancelada ou excluída não volta a ser criada. Renomear um template e reaplicar gera uma tarefa nova com o novo título.

O retorno informa `tasksCreated` e `tasksSkipped`. Sem `forceRuleId`, uma regra já aplicada continua sendo ignorada integralmente.

### 4. Atualização de status de Task fica fora deste módulo

`Task` nasce sempre com `status = PENDENTE` e os endpoints desta etapa (`GET /api/v1/tasks`, `GET /api/v1/tasks/:id`) são somente leitura — não há `PATCH`/`PUT` para transicionar `PENDENTE → EM_ANDAMENTO → CONCLUIDA`/`CANCELADA`.

Essa fronteira é proposital, não uma omissão: o cronograma do TCC trata a gestão operacional de tarefas (quem pode mudar o status, quais transições são válidas, quem pode cancelar, se cancelamento exige motivo, como isso se relaciona com o progresso do evento) como um módulo próprio, posterior a este. Antecipar regras de transição de status agora significaria decidir, sem o contexto completo desse próximo módulo, questões como permissão por papel operacional vs. permissão administrativa, e arriscaria retrabalho quando esse módulo for especificado. Manter esta Parte 2 restrita a "gerar a tarefa certa, uma única vez" mantém o escopo do prompt coeso e testável isoladamente.

## Consequências

- `RuleEngineExecutionService.applyRules()` nunca lança erro por falta de equipe; o chamador (incluindo a transição automática para `CONFIRMADO`) não precisa tratar esse caso como falha.
- `RuleApplication` é uma tabela de controle, sem valor de negócio direto para o usuário final, mas obrigatória para a correção do reprocessamento — não deve ser removida ou ter sua constraint de unicidade relaxada sem revisar este ADR.
- Reprocessamento sem `forceRuleId` e reprocessamento forçado são idempotentes para tarefas e alocações: o primeiro ignora a regra aplicada; o segundo completa ausências e informa quantas tarefas foram ignoradas.
- Editar ou remover templates não altera tarefas já geradas para eventos anteriores.
- `Task.status` além de `PENDENTE`/`CANCELADA` por exclusão de regra não é alcançável nesta etapa; qualquer necessidade de mudar status hoje exige alteração direta no banco, o que é esperado até o próximo módulo ser implementado.
- O próximo módulo do cronograma deve adicionar as rotas de transição de status e decidir permissões específicas (ex.: `tasks:update-status`), sem reabrir o `RuleEngineExecutionService`.
