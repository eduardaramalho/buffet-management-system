# Backend

## Eventos e serviços

Todos os endpoints abaixo exigem `Authorization: Bearer <access-token>`. As respostas usam JSON. Eventos excluídos logicamente não aparecem nas consultas padrão.

### Eventos

| Método | Path | Permissão |
|---|---|---|
| `GET` | `/api/v1/events` | `events:list` |
| `GET` | `/api/v1/events/:id` | `events:read` |
| `POST` | `/api/v1/events` | `events:create` |
| `PUT` | `/api/v1/events/:id` | `events:update` |
| `DELETE` | `/api/v1/events/:id` | `events:delete` |
| `PATCH` | `/api/v1/events/:id/restore` | `events:restore` |
| `POST` | `/api/v1/events/:id/services` | `events:update` |
| `DELETE` | `/api/v1/events/:id/services/:serviceId` | `events:update` |

`GET /api/v1/events` aceita os filtros opcionais `search`, `status`, `from` e `to`.

Exemplo de criação:

```json
{
  "name": "Casamento de Alice e Bruno",
  "eventDate": "2026-10-10T15:00:00.000Z",
  "endDate": null,
  "location": "Salao Principal",
  "serviceType": "CASAMENTO",
  "guestsCount": 120,
  "observations": "Menu sem lactose"
}
```

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
    { "title": "Confirmar fornecedor", "description": "Ligar para o fornecedor", "daysBeforeEvent": 10 },
    { "title": "Separar materiais", "daysBeforeEvent": 2 }
  ]
}
```

`title` tem de 1 a 150 caracteres após o trim; `description` é opcional; `daysBeforeEvent` é um inteiro entre 0 e 365 ou `null`. Os títulos devem ser únicos dentro da regra. No `PUT`, omitir `taskTemplates` preserva os templates atuais; enviar `taskTemplates: []` remove todos. A criação e a substituição dos templates ocorrem na mesma transação da regra.

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
