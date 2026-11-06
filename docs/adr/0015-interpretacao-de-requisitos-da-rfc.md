# ADR 0015: Interpretação de requisitos da RFC

- **Status:** Aceito
- **Data:** 2026-11-03
- **Escopo:** Documentação (RFC, Wiki: Requisitos e Arquitetura). Nenhuma mudança de código.

## Contexto

O cruzamento da RFC (Proposta de Portfólio) com o sistema mostrou quatro pontos em que o texto da RFC admite mais de uma leitura. Nenhum deles exige código novo, mas cada um precisa de uma interpretação registrada, para que a banca encontre a decisão e o motivo.

## Decisões

### 1. "Recursos" são as equipes por especialidade

A RFC (seção 3.1) diz que o motor determina "quais recursos poderão ser necessários", e o cronograma fala em "condições de serviço e recursos". No sistema, o recurso é a **equipe operacional por especialidade** (`RuleResourceRequirement`: especialidade e quantidade mínima). O motor aloca as equipes ao evento, atribui as tarefas a elas (ADR 0010) e gera um alerta quando falta equipe (ADR 0003).

Recursos materiais (mesas, louças, equipamentos) não foram levantados com o stakeholder. Modelá-los seria criar um requisito que a RFC não define, então ficam como trabalho futuro.

### 2. A sequência de execução vem do prazo

A RFC (seção 3.1.1) diz que o motor define "em que sequência [as tarefas] devem ser executadas". Cada modelo de tarefa da regra tem `daysBeforeEvent`, e o motor calcula o prazo a partir da data do evento. **A sequência é a ordem dos prazos.** O quadro de tarefas e a Central do evento listam as tarefas por prazo, com as sem prazo no fim.

Dependências explícitas entre tarefas ("B só começa depois de A") não fazem parte da RFC e ficam como trabalho futuro.

### 3. Glossário: tipo de evento e serviço contratado

A RFC usa "tipo de serviço" com dois sentidos. O sistema separa os dois:

| Termo | Significado | No sistema |
|---|---|---|
| **Tipo de evento** | A natureza do evento: casamento, aniversário, formatura, corporativo, confraternização, batizado ou outro | `Event.serviceType` (enum `EventType`) e a condição `conditionServiceTypeIn` das regras |
| **Serviço contratado** | O que o cliente contratou para aquele evento: bar, buffet completo, decoração e outros | Catálogo `Service` com vínculo N:N `EventService` (ADR 0001 e 0009) e a condição `conditionRequiredServiceIds` |

O nome técnico `serviceType` foi mantido para não exigir migration nem mudar a API às vésperas da entrega. Na interface, o campo aparece como "Tipo de evento".

### 4. Tipos de evento e especialidades como enums

A Tabela 1 da RFC marca a proposta como flexível quanto aos tipos de evento. O sistema atende essa flexibilidade com:

- **condições de regra configuráveis por tipo de evento**, sem código (o gestor cria regras para qualquer combinação de tipo, convidados e serviços);
- **o item "Outro"**, para eventos que não se encaixam nos tipos fixos;
- **o catálogo de serviços**, que cresce sem deploy (ADR 0009).

`EventType` e `TeamSpecialty` continuam sendo enums de propósito. São usados como condição do motor e como requisito de recurso, e um valor fixo garante que uma regra nunca aponte para um tipo ou especialidade inexistente ou excluído. Transformá-los em catálogo exigiria migrar regras, eventos, equipes, relatórios e a replicação.

## Consequências

- As quatro leituras ficam registradas e podem ser citadas na defesa.
- Recursos materiais, dependências entre tarefas e tipos de evento configuráveis entram na lista de trabalhos futuros, ao lado dos que a RFC já cita (notificações, aplicativo móvel, integração financeira).
- Um novo tipo de evento ou especialidade continua exigindo uma migration e a revisão deste ADR.
