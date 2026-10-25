# Backend

## Eventos e serviços

Todos os endpoints abaixo exigem `Authorization: Bearer <access-token>`. As respostas usam JSON. Eventos excluídos logicamente não aparecem nas consultas padrão.

### Eventos

| Método | Path | Permissão |
|---|---|---|
| `GET` | `/api/v1/events` | `events:list` |
| `GET` | `/api/v1/events/deleted` | `events:restore` |
| `GET` | `/api/v1/events/:id` | `events:read` |
| `POST` | `/api/v1/events` | `events:create` |
| `PUT` | `/api/v1/events/:id` | `events:update` |
| `DELETE` | `/api/v1/events/:id` | `events:delete` |
| `PATCH` | `/api/v1/events/:id/restore` | `events:restore` |
| `POST` | `/api/v1/events/:id/services` | `events:update` |
| `DELETE` | `/api/v1/events/:id/services/:serviceId` | `events:update` |
| `GET` | `/api/v1/events/:id/replication-preview` | `events:replicate` |
| `POST` | `/api/v1/events/:id/replicate` | `events:replicate` |

`GET /api/v1/events` aceita os filtros opcionais `search`, `status`, `from` e `to`.

`GET /api/v1/events/deleted` lista os eventos excluídos (soft delete), do mais recente para o mais antigo. `PATCH /api/v1/events/:id/restore` devolve o evento como estava (mesmo status, serviços, equipes e tarefas) e registra `EVENT_RESTORED`; responde 400 se o evento não estiver excluído e 404 se não existir.

Exemplo de criação:

```json
{
  "name": "Casamento de Alice e Bruno",
  "eventDate": "2026-10-10T15:00:00.000Z",
  "endDate": null,
  "location": "Salao Principal",
  "serviceType": "CASAMENTO",
  "guestsCount": 120,
  "observations": "Menu sem lactose",
  "clientId": "client-uuid"
}
```

`clientId` é obrigatório na criação e precisa apontar para um cliente ativo (não excluído). Na edição é opcional; quando enviado, passa pela mesma validação. Eventos criados antes do cadastro de clientes podem ter `clientId: null` (ver [ADR 0005](../../docs/adr/0005-cadastro-de-clientes.md)). As respostas de evento trazem `client` com `id`, `name`, `email`, `phone` e `deletedAt` (o documento não é exposto no evento).

Exemplo de edição:

```json
{
  "location": "Salao Jardim",
  "reason": "Alteracao solicitada pelo cliente"
}
```

Exemplo de vínculo de serviço:

```json
{
  "serviceId": "service-uuid",
  "customLabel": "Fotografia"
}
```

`customLabel` é obrigatório somente para o serviço de catálogo marcado como `isCustom`. Para os demais serviços, deve ser omitido ou enviado como `null`.

### Replicação de evento (RF25)

Reutiliza um evento anterior (qualquer status, não excluído) como base de um novo. Decisões em [ADR 0008](../../docs/adr/0008-replicacao-de-eventos.md). As duas rotas exigem a permissão `events:replicate`, concedida só ao papel `admin` pelo seed. Em bancos já existentes, rode `npm run db:seed` de novo para criá-la.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/events/:id/replication-preview?eventDate=...&endDate=...` | Rascunho somente leitura para a nova data: dados copiáveis, tarefas manuais com prazo recalculado, disponibilidade das equipes e avisos |
| POST | `/api/v1/events/:id/replicate` | Cria a réplica em `PLANEJAMENTO`, em uma transação |

Exemplo de replicação:

```json
{
  "name": "Casamento de Bruna",
  "eventDate": "2026-12-12T18:00:00.000Z",
  "endDate": null,
  "location": "Salao Jardim",
  "serviceType": "CASAMENTO",
  "guestsCount": 150,
  "observations": null,
  "clientId": "client-uuid",
  "services": [{ "serviceId": "service-uuid", "customLabel": null }],
  "tasks": [
    { "sourceTaskId": "task-uuid-1" },
    { "sourceTaskId": "task-uuid-2", "title": "Novo titulo", "dueDate": null }
  ],
  "teamIds": ["team-uuid"]
}
```

- Os dados do evento seguem as mesmas validações da criação. `services`, `tasks` e `teamIds` são opcionais (padrão: lista vazia).
- Só tarefas **manuais** do evento de origem podem ser copiadas; as geradas por regra são criadas de novo pelo motor quando a réplica for confirmada.
- Na tarefa, `dueDate` omitido recalcula o prazo mantendo a distância até o evento; `null` deixa a tarefa sem prazo. Tarefas copiadas nascem `PENDENTE` e guardam `sourceTaskId`.
- Só equipes alocadas ao evento de origem podem ser copiadas. Uma tarefa cuja equipe não foi copiada fica sem equipe.
- O evento criado guarda `sourceEventId`. `GET /api/v1/events/:id` traz `sourceEvent` e `replicas` (eventos criados a partir dele).

Respostas de erro:

| Status | Quando |
|---|---|
| 400 | Regra de negócio (serviço inexistente ou repetido, tarefa que não é manual da origem, equipe que não pertence à origem, data no passado, cliente inativo) |
| 404 | Evento de origem inexistente ou excluído |
| 409 | Equipe indisponível na nova data. O corpo traz `conflicts: [{ teamId, reason: "SCHEDULE_CONFLICT" \| "INACTIVE" \| "NOT_FOUND", conflictingEvent }]` |
| 422 | Payload inválido (Zod) |

### Serviços do catálogo

| Método | Path | Permissão |
|---|---|---|
| `GET` | `/api/v1/services` | `services:list` |
| `GET` | `/api/v1/services/:id` | `services:read` |
| `POST` | `/api/v1/services` | `services:create` |
| `PUT` | `/api/v1/services/:id` | `services:update` |
| `DELETE` | `/api/v1/services/:id` | `services:delete` |

Exemplo de criação:

```json
{
  "name": "Fotografia",
  "isCustom": false
}
```

A exclusão de serviços e eventos é lógica (`deletedAt`); os registros permanecem armazenados para preservar histórico.

Regras do catálogo (RF06, [ADR 0009](../../docs/adr/0009-gestao-do-catalogo-de-servicos.md)):

- O nome é obrigatório e único entre os serviços ativos, sem diferenciar maiúsculas, minúsculas e acentos (collation do MySQL). Espaços nas pontas são removidos.
- O serviço genérico `Outro` (`isCustom: true`) é entrada única do catálogo e é criado pelo seed. Ele pode ser renomeado, mas não excluído.
- O tipo de um serviço (`isCustom`) não muda depois de criado, para não invalidar os rótulos já gravados nos eventos.
- Excluir um serviço já contratado é permitido: os eventos mantêm o serviço no histórico, e ele deixa de ser oferecido em novos eventos.

| Status | Quando |
|---|---|
| 400 | Nome vazio, tentativa de mudar o tipo ou de excluir o `Outro` |
| 404 | Serviço inexistente ou excluído |
| 409 | Nome já usado por outro serviço ativo, ou um segundo serviço genérico |
| 422 | Payload inválido (Zod) |

## Clientes

Cadastro de clientes (pessoa física ou jurídica) vinculados aos eventos. Exclusão sempre lógica (soft delete).

| Método | Path | Permissão |
|---|---|---|
| `GET` | `/api/v1/clients` | `clients:list` |
| `GET` | `/api/v1/clients/:id` | `clients:read` |
| `POST` | `/api/v1/clients` | `clients:create` |
| `PUT` | `/api/v1/clients/:id` | `clients:update` |
| `DELETE` | `/api/v1/clients/:id` | `clients:delete` |

`GET /api/v1/clients` aceita o filtro opcional `search`, que busca por nome, e-mail ou documento (com ou sem pontuação). Clientes excluídos não aparecem.

Exemplo de criação:

```json
{
  "type": "PF",
  "name": "Ana Souza",
  "document": "529.982.247-25",
  "email": "ana@email.com",
  "phone": "(47) 99999-0000",
  "notes": "Prefere contato por WhatsApp"
}
```

O `PUT` é parcial: campos omitidos não são alterados.

Regras de negócio:

- `type`: `PF` ou `PJ`. `name` é obrigatório; `document`, `email`, `phone` e `notes` são opcionais (string vazia vira `null`).
- `document` é validado pelos dígitos verificadores conforme o tipo: CPF para `PF`, CNPJ para `PJ`, incluindo o CNPJ alfanumérico emitido pela Receita Federal desde julho de 2026. É armazenado sem pontuação e em maiúsculas.
- O documento é único entre todos os clientes, inclusive os excluídos. Ao mudar só o `type`, o documento atual é revalidado.
- O e-mail é armazenado em minúsculas.
- A exclusão é bloqueada enquanto o cliente tiver eventos não excluídos em status diferente de `CONCLUIDO` ou `CANCELADO`. Eventos concluídos ou cancelados mantêm o vínculo com o cliente excluído.
- Auditoria: `CLIENT_CREATED`, `CLIENT_UPDATED` (nomes dos campos alterados) e `CLIENT_DELETED`. Por minimização de dados (LGPD), a auditoria não grava documento, e-mail nem telefone.

Respostas de erro:

| Status | Quando |
|---|---|
| `400` | Nome vazio, CPF ou CNPJ inválido |
| `404` | Cliente não encontrado (ou excluído) |
| `409` | Documento já usado (por cliente ativo ou excluído) ou cliente com eventos em aberto |
| `422` | Payload fora do formato (Zod), por exemplo `type` inválido ou e-mail malformado |

## Equipes e colaboradores

Todos os endpoints abaixo exigem `Authorization: Bearer <access-token>`. As respostas usam JSON. Equipes e colaboradores são reutilizáveis e usam soft delete quando aplicável.

### Equipes

| Método | Path | Permissão |
|---|---|---|
| `GET` | `/api/v1/teams` | `teams:list` |
| `GET` | `/api/v1/teams/:id` | `teams:read` |
| `POST` | `/api/v1/teams` | `teams:create` |
| `PUT` | `/api/v1/teams/:id` | `teams:update` |
| `DELETE` | `/api/v1/teams/:id` | `teams:delete` |
| `PATCH` | `/api/v1/teams/:id/activate` | `teams:update` |
| `PATCH` | `/api/v1/teams/:id/deactivate` | `teams:update` |
| `POST` | `/api/v1/teams/:id/members` | `teams:manage-members` |
| `DELETE` | `/api/v1/teams/:id/members/:collaboratorId` | `teams:manage-members` |
| `GET` | `/api/v1/teams/events/:eventId` | `teams:assign-event` |
| `GET` | `/api/v1/teams/:teamId/events` | `teams:assign-event` |
| `POST` | `/api/v1/teams/:teamId/events/:eventId` | `teams:assign-event` |
| `DELETE` | `/api/v1/teams/:teamId/events/:eventId` | `teams:assign-event` |

`GET /api/v1/teams` aceita os filtros opcionais `search`, `specialty` e `status`.

Exemplo de criação:

```json
{
  "name": "Equipe Cozinha A",
  "specialty": "COZINHA",
  "observations": "Atende eventos de até 150 convidados"
}
```

Exemplo de inclusão de membro:

```json
{
  "collaboratorId": "collaborator-uuid",
  "isLeader": true
}
```

Uma equipe pode ter no máximo um membro líder. Um colaborador pode pertencer a várias equipes. Equipes inativas mantêm seus vínculos históricos, mas não podem ser atribuídas a novos eventos.

Exemplo de ativação/inativação:

```http
PATCH /api/v1/teams/team-uuid/deactivate
```

As atribuições de equipe respeitam o status do evento: são permitidas em `PLANEJAMENTO`, mas não em `CONCLUIDO` ou `CANCELADO`. Uma equipe pode ser atribuída a vários eventos, desde que os intervalos não se sobreponham; conflito de agenda retorna `409`. Evento sem `endDate` ocupa o dia inteiro para essa validação.

### Colaboradores

| Método | Path | Permissão |
|---|---|---|
| `GET` | `/api/v1/collaborators` | `collaborators:manage` |
| `GET` | `/api/v1/collaborators/:id` | `collaborators:manage` |
| `POST` | `/api/v1/collaborators` | `collaborators:manage` |
| `PUT` | `/api/v1/collaborators/:id` | `collaborators:manage` |
| `PATCH` | `/api/v1/collaborators/:id/status` | `collaborators:manage` |

`GET /api/v1/collaborators` aceita o filtro opcional `search` por nome. O endpoint de status recebe `{"active": true}` ou `{"active": false}`; não existe exclusão física.

Exemplo de criação:

```json
{
  "name": "Ana Silva",
  "phone": "11999999999",
  "position": "Cozinheira"
}
```

## Regras, tarefas e motor de regras

As regras são gerenciadas por `GET/POST /api/v1/rules` e `GET/PUT/DELETE /api/v1/rules/:id`, usando as permissões `rules:list`, `rules:read`, `rules:create`, `rules:update` e `rules:delete`. O payload de criação e atualização pode embutir até 20 templates de tarefas:

```json
{
  "name": "Casamento grande",
  "resourceRequirements": [],
  "taskTemplates": [
    { "title": "Confirmar fornecedor", "description": "Ligar para o fornecedor", "daysBeforeEvent": 10, "specialty": "BAR" },
    { "title": "Separar materiais", "daysBeforeEvent": 2 }
  ]
}
```

`title` tem de 1 a 150 caracteres após o trim; `description` é opcional; `daysBeforeEvent` é um inteiro entre 0 e 365 ou `null`. Os títulos devem ser únicos dentro da regra. `specialty` é opcional e precisa ser uma das especialidades de `resourceRequirements` (400 caso contrário): ao confirmar o evento, a tarefa gerada vai para a equipe ativa dessa especialidade alocada ao evento que tiver menos tarefas em aberto, com empate para a alocada primeiro ([ADR 0010](../../docs/adr/0010-atribuicao-automatica-de-tarefas.md)). Sem equipe disponível, ou sem `specialty`, a tarefa nasce sem equipe. No `PUT`, omitir `taskTemplates` preserva os templates atuais; enviar `taskTemplates: []` remove todos. A criação e a substituição dos templates ocorrem na mesma transação da regra.

## Tarefas e motor de regras

Todos os endpoints abaixo exigem `Authorization: Bearer <access-token>`. Uma `Task` pode ser gerada pelo motor de regras (`sourceRuleId` preenchido) ou criada manualmente (`sourceRuleId: null`). Tarefas usam soft delete.

### Tarefas

| Método | Path | Permissão |
|---|---|---|
| `GET` | `/api/v1/tasks` | `tasks:list` |
| `GET` | `/api/v1/tasks/:id` | `tasks:read` |
| `POST` | `/api/v1/tasks` | `tasks:create` |
| `PUT` | `/api/v1/tasks/:id` | `tasks:update` |
| `DELETE` | `/api/v1/tasks/:id` | `tasks:delete` |
| `PATCH` | `/api/v1/tasks/:id/status` | `tasks:update-status` |

As permissões `tasks:create`, `tasks:update` e `tasks:delete` são concedidas ao perfil administrador pelo seed.

`GET /api/v1/tasks` aceita os filtros opcionais `eventId` e `status` (`PENDENTE`, `EM_ANDAMENTO`, `CONCLUIDA`, `CANCELADA`).

#### Criação manual

`POST /api/v1/tasks` responde `201` com a tarefa criada, sempre em `PENDENTE` e com `sourceRuleId: null`.

```json
{
  "eventId": "event-uuid",
  "title": "Montar mesas",
  "description": "Salão principal",
  "dueDate": "2026-11-08T15:00:00.000Z",
  "assignedTeamId": "team-uuid"
}
```

`eventId` e `title` são obrigatórios; `description`, `dueDate` e `assignedTeamId` são opcionais. `title` tem de 1 a 150 caracteres após o trim.

#### Edição

`PUT /api/v1/tasks/:id` é parcial: chave omitida não é alterada e `null` limpa o campo.

```json
{
  "description": null,
  "dueDate": "2026-11-09T15:00:00.000Z",
  "assignedTeamId": null
}
```

Campos aceitos: `title`, `description` (`string | null`), `dueDate` (`string | null`) e `assignedTeamId` (`string | null`; `null` desatribui a equipe). O status não é alterado por aqui, e sim por `PATCH /api/v1/tasks/:id/status`. Se nada mudar, a tarefa é devolvida sem gravação nem auditoria.

#### Exclusão

`DELETE /api/v1/tasks/:id` faz soft delete e responde `204`. Excluir uma tarefa gerada por regra não faz o motor recriá-la: a identidade de template considera também tarefas excluídas (ver abaixo).

#### Status

`PATCH /api/v1/tasks/:id/status` recebe `{"status": "EM_ANDAMENTO"}`. `CONCLUIDA` preenche `completedAt`. Tarefas em `CONCLUIDA` ou `CANCELADA` não voltam a `PENDENTE` nem a `EM_ANDAMENTO`.

#### Regras de negócio

- Só é possível criar tarefa em evento existente e não terminal (não `CONCLUIDO` nem `CANCELADO`).
- A equipe atribuída (na criação ou na edição) precisa estar `ATIVA` e já alocada ao evento da tarefa (`POST /api/v1/teams/:teamId/events/:eventId`). Caso contrário, a API responde `400` com "Aloque a equipe ao evento antes de atribuí-la à tarefa".
- O título de tarefa gerada por regra é imutável, pois faz parte da chave de idempotência do motor (ver [ADR 0003](../../docs/adr/0003-task-de-alerta-e-idempotencia-do-motor-de-regras.md)). Descrição, prazo e equipe podem ser editados.
- Tarefas em `CONCLUIDA` ou `CANCELADA` não podem ser editadas nem excluídas.
- `assignedAt` registra o momento em que a equipe atual foi atribuída: é preenchido ao atribuir ou trocar a equipe e volta a `null` ao desatribuir. Alimenta o indicador de tempo médio de atribuição.
- Auditoria: `TASK_CREATED`, `TASK_UPDATED` (com `before`/`after` dos campos alterados), `TASK_DELETED`, `TASK_STATUS_CHANGED` e `TASK_TEAM_ASSIGNED` (equipe anterior e nova).

Erros: corpo inválido retorna `422` com `issues` do Zod; violação de regra de negócio retorna `400` com `message`; tarefa ou evento inexistente também retorna `400`.

### Aplicação de regras (motor de regras — Parte 2)

| Método | Path | Permissão |
|---|---|---|
| `POST` | `/api/v1/events/:eventId/apply-rules` | `rules:apply` |

Aciona manualmente o motor de regras para o evento informado: avalia as regras ativas que casam com o evento e, para cada regra ainda não aplicada a ele, gera as `Task` correspondentes e tenta atribuir automaticamente as equipes exigidas. O mesmo processamento é disparado automaticamente quando um evento transiciona para o status `CONFIRMADO`.

Corpo opcional, usado apenas para reprocessamento forçado de uma regra específica:

```json
{
  "forceRuleId": "rule-uuid"
}
```

Sem `forceRuleId`, regras já aplicadas ao evento (controladas por `RuleApplication`) são ignoradas — a aplicação de regras é idempotente por padrão (ver ADR 0003).

Em um reprocessamento com `forceRuleId`, o motor completa somente o que ainda não existe. A identidade de uma tarefa de template é `(eventId, sourceRuleId, title)` e considera tarefas em qualquer status, inclusive canceladas e com soft delete. Alertas de falta de equipe são idempotentes por `(eventId, sourceRuleId, especialidade)`. Tarefas já geradas nunca são alteradas por edições ou remoções posteriores de templates; renomear um template e reaplicar gera uma nova tarefa com o novo nome.

Resposta:

```json
{
  "tasksCreated": 2,
  "tasksSkipped": 0,
  "teamsAutoAssigned": 1,
  "alertsGenerated": 1
}
```

### Acompanhamento do evento

| Método | Path | Permissão |
|---|---|---|
| `GET` | `/api/v1/events/:eventId/rule-applications` | `rules:read` |
| `GET` | `/api/v1/events/:eventId/history` | `audit:read` |

As aplicações de regras retornam `ruleId`, `ruleName` e `appliedAt`, ordenadas da mais recente para a mais antiga. Ambos os endpoints retornam `404` para eventos inexistentes ou excluídos logicamente.

O histórico retorna no máximo 20 registros de auditoria do próprio evento, com `id`, `action`, `message`, `actorName` e `createdAt`; o campo interno `changes` nunca é exposto.

## Relatórios

Relatórios gerenciais da RFC (seção 4): eventos realizados, tarefas executadas e desempenho operacional das equipes, além dos indicadores da hipótese (tarefas esquecidas e tempo de atribuição). Somente leitura, sem alteração de schema. Decisões em ADR 0006.

| Método | Path | Permissão |
|---|---|---|
| `GET` | `/api/v1/reports/events` | `reports:view` |
| `GET` | `/api/v1/reports/events/export` | `reports:view` |
| `GET` | `/api/v1/reports/tasks` | `reports:view` |
| `GET` | `/api/v1/reports/tasks/export` | `reports:view` |
| `GET` | `/api/v1/reports/teams-performance` | `reports:view` |
| `GET` | `/api/v1/reports/teams-performance/export` | `reports:view` |

A permissão `reports:view` é concedida só ao papel `admin` pelo seed. Em bancos já existentes, rode `npm run db:seed` de novo para criá-la.

### Parâmetros

Todos os endpoints exigem o período `from` e `to` (ISO 8601, ex.: `2026-10-01T03:00:00.000Z`). O frontend envia o início do primeiro dia e o fim do último dia no fuso do usuário.

| Endpoint | Filtros opcionais |
|---|---|
| `events` | `status` (`EventStatus`), `serviceType` (`EventType`), `clientId` |
| `tasks` | `status` (`TaskStatus`), `teamId`, `origin` (`REGRA` ou `MANUAL`) |
| `teams-performance` | nenhum |

- Listagens JSON de `events` e `tasks` são paginadas: `page` (padrão 1) e `pageSize` (padrão 20, máximo 100). `teams-performance` não pagina (uma linha por equipe).
- Exportações recebem `format` (`csv` ou `pdf`) e trazem todas as linhas do período, sem paginação.
- O período vale sempre pela **data do evento** (`eventDate`), inclusive nos relatórios de tarefas e equipes, para que os três relatórios descrevam o mesmo conjunto de eventos.

### Definições dos indicadores

| Indicador | Definição |
|---|---|
| Tarefa esquecida (atrasada em aberto) | Status `PENDENTE` ou `EM_ANDAMENTO` com `dueDate` anterior ao momento da consulta |
| Concluída no prazo / com atraso | Status `CONCLUIDA` com `completedAt <= dueDate` / `completedAt > dueDate`. Tarefas sem prazo não entram |
| Pontualidade | `no prazo / (no prazo + com atraso)`. `null` ("Sem dados") quando não há o que medir. Canceladas aparecem só como contagem |
| Origem | `REGRA` quando a tarefa veio do motor (`sourceRuleId` preenchido), `MANUAL` caso contrário |
| Atribuição média | Média de `assignedAt - createdAt` em minutos, separada por origem, ponderada pelo número de tarefas atribuídas |

Limitações conhecidas do tempo de atribuição: o motor gera tarefas sem equipe, então o valor de `REGRA` mede da geração até a atribuição manual; e `assignedAt` é sobrescrito a cada reatribuição, medindo a última atribuição. Tarefas anteriores à coluna `assigned_at` não entram na média.

O desempenho das equipes considera só tarefas com equipe atribuída e inclui equipes inativas ou excluídas que tiveram tarefas no período (relatório histórico).

### Exportação

- **CSV:** UTF-8 com BOM, separador `;` e quebra de linha CRLF (abre direto no Excel pt-BR). Células de texto iniciadas por `=`, `+`, `-`, `@`, tab ou CR recebem `'` na frente (proteção contra CSV injection, OWASP).
- **PDF:** A4 paisagem gerado com [PDFKit](https://pdfkit.org) (licença MIT): título, período, data de geração, resumo, tabela com quebra de texto, cabeçalho repetido a cada página e numeração "x de y".
- Datas dos arquivos ficam no fuso `America/Sao_Paulo`, independente do fuso do servidor.
- Resposta com `Content-Disposition: attachment` (nome `relatorio-<tipo>_<inicio>_<fim>.<ext>`) e `Cache-Control: no-store`. O CORS expõe `Content-Disposition` para o frontend ler o nome do arquivo.
- Cada exportação gera auditoria `REPORT_EXPORTED` com tipo, formato, filtros e número de linhas (rastreabilidade de dados pessoais, LGPD).

### Respostas de erro

| Status | Quando |
|---|---|
| `401` | Sem token |
| `403` | Sem `reports:view` |
| `422` | Período ausente ou inválido, `to` anterior a `from`, período maior que 366 dias, filtro fora do enum, `page`/`pageSize` fora dos limites, `format` inválido |

### Consultas

Cada relatório executa um número fixo de consultas, independente do número de linhas (sem N+1): `groupBy`/`count` do Prisma para totais, uma `findMany` paginada com `select` das relações, um `groupBy` por `(eventId, status)` para contar tarefas dos eventos da página e uma única consulta SQL parametrizada (`Prisma.sql`) para o desempenho das equipes.
