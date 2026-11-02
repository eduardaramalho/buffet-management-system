# ADR 0008: Replicação de eventos (RF25)

- **Status:** Aceito
- **Escopo:** Backend (`modules/events`, `modules/teams`, `modules/tasks/domain`, `prisma/schema.prisma`, migration `20261023180000_add_event_replication`, `prisma/seed.ts`), frontend (`ReplicateEventDialog`, `EventDetailsPage`, `utils/dateInput`), E2E (passo 15 da jornada)

## Contexto

A RFC (seção 3.1) prevê reutilizar a configuração de eventos anteriores: consultar um evento já realizado e replicar sua estrutura operacional em um novo evento, reduzindo o tempo de planejamento e padronizando os processos. O requisito estava registrado como RF25 (pendente) na Wiki.

Um evento é formado por dados próprios (cliente, local, tipo, convidados, observações), serviços contratados, equipes alocadas e tarefas. As tarefas têm duas origens: as geradas pelo motor de regras (com `sourceRuleId`) e as manuais (RF17). Replicar exige decidir o que é copiado, o que é recalculado e como manter a rastreabilidade.

## Decisões

1. **O que é copiado.** Tipo, local, convidados, observações, cliente e serviços contratados vêm pré-preenchidos e **todos são editáveis**. Nome e data **sempre** são informados de novo. A réplica nasce em `PLANEJAMENTO` (RN01).
2. **Tarefas geradas por regra não são copiadas.** O motor as gera de novo quando a réplica for confirmada (RN12), com prazos calculados a partir da nova data. Copiá-las criaria tarefas fora da idempotência por evento (RN13) e com prazos de outra data.
3. **Tarefas manuais são copiadas com prazo recalculado:** `novoPrazo = novaData + (prazoOriginal - dataOriginal)`, preservando a distância e o horário (função pura `shiftDueDate`). Sempre como `PENDENTE`. Canceladas na origem vêm desmarcadas por padrão. Um prazo recalculado que cai no passado é permitido e sinalizado na revisão. Se a equipe da tarefa não for copiada, a tarefa fica sem equipe (RN17).
4. **Equipes alocadas são copiadas**, desde que estejam disponíveis na nova data. A disponibilidade (RN08 e RN09) passou a ter uma única implementação, `EventTeamService.checkAvailability`, usada pela alocação existente (RF11), pelo preview e pela replicação. Qualquer equipe indisponível recusa a operação inteira com **409**, listando todas as equipes e o motivo, para o usuário resolver tudo de uma vez.
5. **Duas rotas, com o backend como dono das regras:**
   - `GET /api/v1/events/:id/replication-preview?eventDate&endDate`: somente leitura; devolve o rascunho, prazos recalculados, disponibilidade das equipes e avisos (cliente ou serviço removidos).
   - `POST /api/v1/events/:id/replicate`: valida tudo antes de escrever e grava evento, serviços, equipes e tarefas em **uma transação**. Na tarefa, `dueDate` omitido significa "recalcular" e `null` significa "sem prazo".
6. **Permissão própria `events:replicate`** (seed: `admin`), porque a operação também cria tarefas e aloca equipes; reaproveitar `events:create` daria esses poderes implicitamente a quem só cadastra eventos.
7. **Qualquer evento não excluído pode ser origem**, inclusive Concluído e Cancelado (repetir um evento realizado é o caso principal).
8. **Rastreabilidade máxima:**
   - `Event.sourceEventId` e `Task.sourceTaskId` (FKs nulas, `ON DELETE RESTRICT`; nada é apagado fisicamente, RNF07).
   - Auditoria após o commit: `EVENT_REPLICATED` na réplica (origem, campos alterados em relação à origem, mapa tarefa origem para tarefa nova, tarefas e equipes descartadas), `EVENT_USED_AS_TEMPLATE` na origem (aparece no histórico, RF21), `TASK_CREATED` e `TEAM_ASSIGNED_TO_EVENT` com `replicatedFrom...`.
   - Interface: selo "Replicado de X" com link, painel "Eventos criados a partir deste" e marcação "Copiada do evento de origem" nas tarefas.
9. **Arquitetura:** novo `EventReplicationService` (SRP, sem inchar o `EventManagementService`), que só conhece portas (`eventReplication.types.ts`). Os adaptadores para Tasks e Teams ficam em `infrastructure/adapters/replicationGateways.ts` e são ligados no `event.factory.ts`. As regras de criação de evento (`assertCanCreate`), o rótulo do serviço "Outro" (`normalizeServiceLabel`) e os schemas Zod do evento foram extraídos para serem compartilhados (DRY).
10. **Interface em dois passos** (painel lateral do design system): 1) dados do novo evento; 2) revisão com aviso de atenção, onde o usuário marca, desmarca e edita título e prazo das tarefas e escolhe as equipes. Em 409, a revisão recarrega a disponibilidade sem perder as edições das tarefas.

## Prós

- Nenhuma regra de negócio duplicada no frontend: prazos e disponibilidade vêm do preview.
- Operação atômica: falha em qualquer escrita não deixa evento parcial nem registro de auditoria.
- Linhagem consultável no banco e no histórico, em ambos os sentidos.
- A refatoração de `checkAvailability` removeu a duplicação potencial de RN08 e RN09.

## Contras e limitações

- **Janela de concorrência:** a disponibilidade é checada antes da transação; uma alocação concorrente entre a checagem e a escrita pode gerar sobreposição. É o mesmo comportamento da alocação manual existente; mitigação futura seria uma restrição no banco ou bloqueio pessimista.
- A auditoria é gravada fora da transação (padrão atual do `AuditService`); se falhar após o commit, a réplica existe sem o registro, mas a linhagem continua no banco (`sourceEventId`).
- O formulário de eventos não usa horário de término; a réplica segue o mesmo padrão (`endDate` nulo, o evento ocupa o dia inteiro para fins de conflito, RN09).
- Apenas equipes do evento de origem podem ser copiadas; incluir outras é feito depois, na edição do evento.

## Alternativas descartadas

- **Pré-preencher o formulário de evento no frontend:** simples, mas levaria regra de negócio ao cliente, não copiaria tarefas manuais de forma atômica e não deixaria rastro de origem.
- **Copiar também as tarefas da regra:** quebraria a idempotência do motor e copiaria prazos de outra data.
- **Ignorar silenciosamente equipes em conflito:** menos atrito, mas o usuário acharia que a equipe foi copiada. A decisão foi tornar o conflito explícito.
- **Usar `EventTeamService.assignTeamToEvent` dentro da transação:** ele lê o evento fora da transação e não enxergaria a réplica ainda não commitada; por isso a escrita usa o repositório com a transação, e a validação usa `checkAvailability`.
