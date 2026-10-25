# ADR 0010: Atribuição automática das tarefas geradas às equipes

- **Status:** Aceito
- **Escopo:** Backend (`rule_task_templates.specialty`, migration `20261025180000_add_task_template_specialty`, `RuleEngineService`, `RuleController`, `RuleEngineExecutionService`), frontend (`RuleForm`), E2E (passos 6, 10 e 11)

## Contexto

A RFC (seção 3.1) promete a "atribuição automática às equipes responsáveis". O motor de regras alocava as equipes ao **evento** (RF14), mas cada **tarefa** gerada nascia sem equipe, e o gestor precisava atribuí-las uma a uma. A Rastreabilidade RFC marcava o item como parcial. O modelo de tarefa não tinha nenhum vínculo com uma especialidade, então o motor não tinha como saber qual equipe deveria receber cada tarefa.

## Decisões

1. **Especialidade opcional no modelo de tarefa** (`RuleTaskTemplate.specialty`). O vínculo é explícito: "Montar o bar → Bar". Sem especialidade, a tarefa continua sem equipe, como um lembrete geral.
2. **A especialidade precisa estar entre os requisitos da própria regra** (400). É a regra que garante a alocação daquela equipe ao evento. Na edição, a checagem usa os requisitos e modelos atuais para o que não foi enviado. No formulário, trocar ou remover o requisito limpa a especialidade das tarefas que apontavam para ele.
3. **Escolha da equipe:** entre as equipes **ativas** da especialidade alocadas ao evento (RN17), recebe a tarefa a que tem **menos tarefas em aberto** (Pendente ou Em andamento, não excluídas) no evento. O empate vai para a equipe alocada primeiro. Valem tanto as equipes alocadas pelo motor quanto as alocadas à mão antes da confirmação.
4. **Sem equipe disponível,** a tarefa fica sem equipe. O alerta de falta de equipe (RN15, ADR 0003) já sinaliza o problema.
5. **Mesma transação e auditoria:** a atribuição acontece na criação da tarefa, dentro da transação da regra. `assignedAt` é preenchido (indicador de tempo de atribuição). `TASK_GENERATED` passa a registrar `assignedTeamId`, e `TASK_TEAM_ASSIGNED` é gravado com `automatic: true`.
6. **Sem efeito retroativo:** tarefas já geradas e modelos sem especialidade continuam como estão. A migration é aditiva (coluna nula).

## Prós

- Fecha a promessa da RFC sem mudar a idempotência do motor (a chave continua sendo regra + título).
- A carga fica distribuída quando a regra exige mais de uma equipe da mesma especialidade.
- O gestor continua podendo trocar a equipe de qualquer tarefa depois (ajuste manual, RFC 3.1).

## Contras e limitações

- O balanceamento olha só o evento atual, não a carga das equipes em outros eventos no mesmo período.
- Um modelo aponta para uma única especialidade; tarefas que exigem duas equipes precisam ser divididas em dois modelos.
- Uma equipe inativa vinculada à mão conta para o requisito (comportamento anterior do motor), mas nunca recebe tarefa; nesse caso a tarefa fica sem equipe e sem alerta.

## Alternativas descartadas

- **Inferir pela regra:** se a regra exige uma única especialidade, todas as tarefas iriam para ela. É mais simples, mas implícito e inútil para regras com várias especialidades.
- **Sempre a primeira equipe alocada:** é previsível, mas concentra todas as tarefas em uma equipe.
- **Permitir qualquer especialidade no modelo:** a tarefa poderia apontar para uma equipe que a regra nunca aloca, gerando tarefas sem equipe sem nenhum alerta.
