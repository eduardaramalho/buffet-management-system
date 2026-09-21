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
